export interface RpcSmokeTarget {
  chainId: number;
  chainName: string;
  url: string;
  contract: { address: string; data: string; expectedResult: string };
}

export interface RpcSmokeOptions {
  origin: string;
  timeoutMs: number;
  fetch?: typeof globalThis.fetch;
}

export interface RpcSmokeCheck {
  name: "chainId" | "cors" | "block" | "balance" | "contract" | "logs" | "receipt";
  status: "pass" | "fail" | "skip";
  detail: string;
}

export interface RpcSmokeResult {
  target: RpcSmokeTarget;
  checks: RpcSmokeCheck[];
}

interface RpcBlock {
  number: string;
  hash: string;
  timestamp: string;
  transactions: string[];
}

const checkOrder: RpcSmokeCheck["name"][] = [
  "chainId", "cors", "block", "balance", "contract", "logs", "receipt",
];
const zeroAddress = `0x${"0".repeat(40)}`;
const quantityPattern = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/;
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const bytesPattern = /^0x(?:[0-9a-fA-F]{2})*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuantity(value: unknown): value is string {
  return typeof value === "string" && quantityPattern.test(value);
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && hashPattern.test(value) && !/^0x0+$/.test(value);
}

function readBlock(value: unknown, expectedNumber?: bigint): RpcBlock {
  if (!isRecord(value) || !isQuantity(value.number)) throw new Error("invalid block number");
  if (expectedNumber !== undefined && BigInt(value.number) !== expectedNumber) {
    throw new Error("block number does not match request");
  }
  if (!isHash(value.hash)) throw new Error("invalid block hash");
  if (!isQuantity(value.timestamp) || BigInt(value.timestamp) === 0n) {
    throw new Error("invalid block timestamp");
  }
  if (!Array.isArray(value.transactions) || !value.transactions.every(isHash)) {
    throw new Error("invalid block transactions");
  }
  return {
    number: value.number,
    hash: value.hash,
    timestamp: value.timestamp,
    transactions: value.transactions,
  };
}

function validateLog(value: unknown, block: RpcBlock, address?: string, transactionHash?: string): void {
  if (
    !isRecord(value) ||
    typeof value.address !== "string" || !addressPattern.test(value.address) ||
    (address !== undefined && value.address.toLowerCase() !== address.toLowerCase()) ||
    !isQuantity(value.blockNumber) || BigInt(value.blockNumber) !== BigInt(block.number) ||
    typeof value.blockHash !== "string" || value.blockHash.toLowerCase() !== block.hash.toLowerCase() ||
    !isHash(value.transactionHash) ||
    (transactionHash !== undefined && value.transactionHash.toLowerCase() !== transactionHash.toLowerCase()) ||
    !isQuantity(value.transactionIndex) || !isQuantity(value.logIndex) ||
    BigInt(value.transactionIndex) >= BigInt(block.transactions.length) ||
    block.transactions[Number(BigInt(value.transactionIndex))].toLowerCase() !== value.transactionHash.toLowerCase() ||
    typeof value.data !== "string" || !bytesPattern.test(value.data) ||
    !Array.isArray(value.topics) || value.topics.length > 4 ||
    !value.topics.every((topic) => typeof topic === "string" && hashPattern.test(topic)) ||
    (value.removed !== undefined && value.removed !== false)
  ) throw new Error("invalid or mismatched log entry");
}

/** Read-only live capability checks. Each HTTP request has one bounded attempt. */
export async function probeRpcEndpoint(
  target: RpcSmokeTarget,
  options: RpcSmokeOptions,
): Promise<RpcSmokeResult> {
  const fetch = options.fetch ?? globalThis.fetch;
  const checks: RpcSmokeCheck[] = [];
  const corsFailures = new Set<string>();
  let rpcResponseCount = 0;
  let nextId = 1;

  async function fetchBounded(init: RequestInit, onHeaders?: (response: Response) => void) {
    const controller = new AbortController();
    const timeoutError = new Error(`request timed out after ${options.timeoutMs} ms`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let readingBody = false;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(timeoutError);
        controller.abort();
      }, options.timeoutMs);
    });
    try {
      return await Promise.race([
        (async () => {
          const response = await fetch(target.url, { ...init, redirect: "manual", signal: controller.signal });
          onHeaders?.(response);
          readingBody = true;
          const body = await response.text();
          return { response, body };
        })(),
        deadline,
      ]);
    } catch (error) {
      if (error === timeoutError) throw timeoutError;
      throw new Error(readingBody ? "response body could not be read" : "network request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  function allowsOrigin(response: Response): boolean {
    const allowed = response.headers.get("access-control-allow-origin");
    return allowed === "*" || allowed === options.origin;
  }

  function allowsList(response: Response, header: string, expected: string): boolean {
    const values = (response.headers.get(header) ?? "").split(",").map((value) => value.trim().toLowerCase());
    return values.includes("*") || values.includes(expected);
  }

  async function rpc(method: string, params: unknown[]): Promise<unknown> {
    const id = nextId++;
    const { response, body } = await fetchBounded({
      method: "POST",
      headers: { Origin: options.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }, (response) => {
      rpcResponseCount++;
      if (!allowsOrigin(response)) corsFailures.add(`${method}: POST origin is not allowed`);
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error("response is not valid JSON");
    }
    if (!isRecord(payload) || payload.jsonrpc !== "2.0" || payload.id !== id) {
      throw new Error("invalid JSON-RPC envelope or response ID");
    }
    if ("error" in payload) {
      if ("result" in payload || !isRecord(payload.error) ||
        !Number.isInteger(payload.error.code) || typeof payload.error.message !== "string") {
        throw new Error("invalid JSON-RPC error response");
      }
      throw new Error(`JSON-RPC error ${payload.error.code}`);
    }
    if (!("result" in payload)) throw new Error("JSON-RPC response has no result");
    return payload.result;
  }

  async function check(name: RpcSmokeCheck["name"], run: () => Promise<string>): Promise<boolean> {
    try {
      checks.push({ name, status: "pass", detail: await run() });
      return true;
    } catch (error) {
      checks.push({ name, status: "fail", detail: error instanceof Error ? error.message : "check failed" });
      return false;
    }
  }

  function finish(): RpcSmokeResult {
    if (rpcResponseCount === 0) corsFailures.add("no POST response headers available");
    checks.push({
      name: "cors",
      status: corsFailures.size ? "fail" : "pass",
      detail: corsFailures.size ? [...corsFailures].join("; ") : "preflight and all POST responses allow the requested origin",
    });
    checks.sort((a, b) => checkOrder.indexOf(a.name) - checkOrder.indexOf(b.name));
    return { target, checks };
  }

  try {
    const { response } = await fetchBounded({
      method: "OPTIONS",
      headers: {
        Origin: options.origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    if (!response.ok) corsFailures.add(`preflight: HTTP ${response.status}`);
    if (!allowsOrigin(response)) corsFailures.add("preflight: origin is not allowed");
    // POST is CORS-safelisted even when JSON content-type requires preflight;
    // Access-Control-Allow-Methods need not explicitly list it.
    if (!allowsList(response, "access-control-allow-headers", "content-type")) corsFailures.add("preflight: content-type is not allowed");
  } catch (error) {
    corsFailures.add(`preflight: ${error instanceof Error ? error.message : "request failed"}`);
  }

  const chainMatches = await check("chainId", async () => {
    const value = await rpc("eth_chainId", []);
    if (!isQuantity(value)) throw new Error("invalid chain ID quantity");
    if (BigInt(value) !== BigInt(target.chainId)) throw new Error(`wrong chain: expected ${target.chainId}`);
    return `chain ${target.chainId}`;
  });
  if (!chainMatches) {
    for (const name of checkOrder.filter((name) => name !== "chainId" && name !== "cors")) {
      checks.push({ name, status: "skip", detail: "chain ID was not verified" });
    }
    return finish();
  }

  let head: RpcBlock | undefined;
  await Promise.all([
    check("block", async () => {
      const block = readBlock(await rpc("eth_getBlockByNumber", ["latest", false]));
      if (BigInt(block.number) === 0n) throw new Error("latest block number is zero");
      const age = BigInt(Math.floor(Date.now() / 1_000)) - BigInt(block.timestamp);
      if (age > 120n) throw new Error("latest block is more than 120 seconds old");
      if (age < -15n) throw new Error("latest block is more than 15 seconds in the future");
      head = block;
      return `fresh block ${BigInt(block.number)}`;
    }),
    check("balance", async () => {
      if (!isQuantity(await rpc("eth_getBalance", [zeroAddress, "latest"]))) throw new Error("invalid balance quantity");
      return "native balance read succeeded";
    }),
    check("contract", async () => {
      if (!addressPattern.test(target.contract.address) || !bytesPattern.test(target.contract.data) ||
        !hashPattern.test(target.contract.expectedResult)) throw new Error("invalid contract probe fixture");
      const value = await rpc("eth_call", [{ to: target.contract.address, data: target.contract.data }, "latest"]);
      if (typeof value !== "string" || !hashPattern.test(value) ||
        value.toLowerCase() !== target.contract.expectedResult.toLowerCase()) {
        throw new Error("contract result does not match the expected 32-byte value");
      }
      return "known contract returned the expected value";
    }),
  ]);

  if (!head) {
    for (const name of ["logs", "receipt"] as const) {
      checks.push({ name, status: "skip", detail: "a fresh block was not verified" });
    }
    return finish();
  }
  const block = head;
  await Promise.all([
    check("logs", async () => {
      const logs = await rpc("eth_getLogs", [{ fromBlock: block.number, toBlock: block.number, address: target.contract.address }]);
      if (!Array.isArray(logs)) throw new Error("logs result is not an array");
      for (const log of logs) validateLog(log, block, target.contract.address);
      return `one-block log query succeeded (${logs.length} entries)`;
    }),
    (async () => {
      let foundTransaction = false;
      await check("receipt", async () => {
        const headNumber = BigInt(block.number);
        const first = headNumber > 32n ? headNumber - 32n : 0n;
        for (let offset = 0n; offset < 3n && first >= offset; offset++) {
          const candidateNumber = first - offset;
          const candidate = readBlock(await rpc("eth_getBlockByNumber", [`0x${candidateNumber.toString(16)}`, false]), candidateNumber);
          const transactionHash = candidate.transactions[0];
          if (!transactionHash) continue;
          foundTransaction = true;
          const receipt = await rpc("eth_getTransactionReceipt", [transactionHash]);
          if (!isRecord(receipt)) throw new Error("a real confirmed transaction has no receipt");
          if (typeof receipt.transactionHash !== "string" || receipt.transactionHash.toLowerCase() !== transactionHash.toLowerCase() ||
            typeof receipt.blockHash !== "string" || receipt.blockHash.toLowerCase() !== candidate.hash.toLowerCase() ||
            !isQuantity(receipt.blockNumber) || BigInt(receipt.blockNumber) !== candidateNumber ||
            !isQuantity(receipt.transactionIndex) || BigInt(receipt.transactionIndex) !== 0n ||
            (receipt.status !== "0x0" && receipt.status !== "0x1") || !Array.isArray(receipt.logs)) {
            throw new Error("receipt does not match the confirmed transaction and block");
          }
          for (const log of receipt.logs) validateLog(log, candidate, undefined, transactionHash);
          return "real confirmed transaction receipt matched its block";
        }
        return "no transactions in the bounded three-block search";
      });
      const receiptCheck = checks.find((item) => item.name === "receipt");
      if (!foundTransaction && receiptCheck?.status === "pass") receiptCheck.status = "skip";
    })(),
  ]);
  return finish();
}
