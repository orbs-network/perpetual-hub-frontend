import { encodeFunctionData, erc20Abi, toHex } from "viem";
import { findChainById } from "../src/config/chains";
import { RPC_URLS_BY_CHAIN } from "../src/config/constants";
import { partner } from "../src/config/partners";
import { loadPartnerChains } from "../src/config/partners/loadChains";
import {
  probeRpcEndpoint,
  type RpcSmokeOptions,
  type RpcSmokeResult,
  type RpcSmokeTarget,
} from "./rpc-smoke-model";

export interface RpcSmokeCLIIO {
  loadConfig: () => Promise<{ targets: RpcSmokeTarget[]; origin: string }>;
  probe: (target: RpcSmokeTarget, options: RpcSmokeOptions) => Promise<RpcSmokeResult>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

interface Options {
  chainIds: Set<number>;
  origin?: string;
  timeoutMs: number;
  concurrency: number;
  json: boolean;
  list: boolean;
}

const usage = `Usage: npm run smoke:rpc -- [options]

Read-only checks of RPCs for the selected partner's API-provided chains.
  --chain <id[,id]>       Limit to chain IDs (repeatable)
  --origin <origin>       Browser origin (default: selected partner's origin)
  --timeout-ms <ms>       Timeout per request, including response body (default: 5000)
  --concurrency <1..8>    Endpoints checked concurrently (default: 2)
  --list                 Print discovered targets without RPC requests
  --json                 Emit a JSON report
  --help                 Show this help without network requests

Exit codes: 0 = all checks passed; 1 = failed/incomplete checks; 2 = invalid arguments/config.
This optional diagnostic does not submit transactions or deploy anything.
`;

function positiveInteger(value: string, label: string): number {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return number;
}

function browserOrigin(value: string): string {
  const parsed = new URL(value);
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username || parsed.password || parsed.search || parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error("--origin must be an HTTP(S) origin without credentials, a path, query or fragment");
  }
  return parsed.origin;
}

function parseOptions(args: string[]): Options {
  const options: Options = { chainIds: new Set(), timeoutMs: 5_000, concurrency: 2, json: false, list: false };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--json") { options.json = true; continue; }
    if (flag === "--list") { options.list = true; continue; }
    if (!["--chain", "--origin", "--timeout-ms", "--concurrency"].includes(flag)) {
      throw new Error(`Unknown argument: ${flag}`);
    }
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--chain") {
      for (const id of value.split(",")) options.chainIds.add(positiveInteger(id.trim(), "Chain ID"));
    } else if (flag === "--origin") {
      options.origin = browserOrigin(value);
    } else if (flag === "--timeout-ms") {
      options.timeoutMs = positiveInteger(value, "Timeout");
      if (options.timeoutMs > 2_147_483_647) throw new Error("Timeout exceeds the supported timer range");
    } else {
      options.concurrency = positiveInteger(value, "Concurrency");
      if (options.concurrency > 8) throw new Error("Concurrency must be between 1 and 8");
    }
  }
  return options;
}

export async function loadRpcSmokeConfig(): Promise<{ targets: RpcSmokeTarget[]; origin: string }> {
  await loadPartnerChains();
  const targets: RpcSmokeTarget[] = [];
  for (const lane of partner.chains) {
    const chainId = lane.chainId;
    const chain = findChainById(chainId);
    const configuredRpcUrls = RPC_URLS_BY_CHAIN[chainId];
    const urls = configuredRpcUrls?.length
      ? configuredRpcUrls
      : chain?.rpcUrls.default.http ?? [];
    if (!chain || !urls.length) throw new Error(`Missing chain metadata or RPC URLs for ${chainId}`);
    const contract = {
      address: lane.collateralAddress,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "decimals" }),
      expectedResult: toHex(lane.collateralDecimals, { size: 32 }),
    };
    for (const url of new Set(urls)) {
      if (new URL(url).protocol !== "https:") throw new Error(`Production chain ${chainId} must use HTTPS RPCs`);
      targets.push({ chainId, chainName: lane.chainName, url, contract });
    }
  }
  return { targets, origin: partner.deployedOrigin };
}

const defaultIO: RpcSmokeCLIIO = {
  loadConfig: loadRpcSmokeConfig,
  probe: probeRpcEndpoint,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

function resultStatus(result: RpcSmokeResult): "passed" | "failed" | "incomplete" {
  if (result.checks.some((check) => check.status === "fail")) return "failed";
  if (!result.checks.length || result.checks.some((check) => check.status === "skip")) return "incomplete";
  return "passed";
}

function endpointLabel(target: RpcSmokeTarget): string {
  const url = new URL(target.url);
  // Public configured endpoints are printable; omit query parameters and userinfo.
  return `${target.chainName} (${target.chainId}) ${url.origin}${url.pathname}${url.search ? "?[redacted]" : ""}`;
}

export async function runRpcSmokeCLI(args: string[], io: RpcSmokeCLIIO = defaultIO): Promise<number> {
  if (args.includes("--help")) { io.stdout(usage); return 0; }
  try {
    const options = parseOptions(args);
    const config = await io.loadConfig();
    const origin = browserOrigin(options.origin ?? config.origin);
    const knownIds = new Set(config.targets.map((target) => target.chainId));
    for (const id of options.chainIds) {
      if (!knownIds.has(id)) throw new Error(`No configured production RPCs for chain ${id}`);
    }
    const targets = config.targets.filter((target) => !options.chainIds.size || options.chainIds.has(target.chainId));
    if (!targets.length) throw new Error("No configured production RPCs to check");
    if (options.list) {
      io.stdout(options.json
        ? `${JSON.stringify({ origin, timeoutMs: options.timeoutMs, targets }, null, 2)}\n`
        : `Origin: ${origin}\n${targets.map(endpointLabel).join("\n")}\n${targets.length} endpoints; no RPC requests.\n`);
      return 0;
    }

    if (!options.json) io.stdout(`Checking ${targets.length} RPC endpoints; origin ${origin}; ${options.timeoutMs} ms/request; concurrency ${options.concurrency}.\n`);
    const results = new Array<RpcSmokeResult>(targets.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(options.concurrency, targets.length) }, async () => {
      while (next < targets.length) {
        const index = next++;
        const target = targets[index];
        try {
          results[index] = await io.probe(target, { origin, timeoutMs: options.timeoutMs });
        } catch {
          results[index] = { target, checks: [{ name: "chainId", status: "fail", detail: "Probe failed unexpectedly" }] };
        }
        if (!options.json) {
          const result = results[index];
          io.stdout(`${resultStatus(result).toUpperCase()} ${endpointLabel(target)}\n`);
          for (const check of result.checks) {
            if (check.status !== "pass") io.stdout(`  ${check.status.toUpperCase()} ${check.name}: ${check.detail}\n`);
          }
        }
      }
    }));
    const summary = { passed: 0, failed: 0, incomplete: 0, total: results.length };
    for (const result of results) summary[resultStatus(result)]++;
    io.stdout(options.json
      ? `${JSON.stringify({ origin, timeoutMs: options.timeoutMs, results, summary }, null, 2)}\n`
      : `RPC smoke: ${summary.passed} passed, ${summary.failed} failed, ${summary.incomplete} incomplete (${summary.total} endpoints).\n`);
    return summary.failed || summary.incomplete ? 1 : 0;
  } catch (error) {
    io.stderr(`${error instanceof Error ? error.message : "RPC smoke configuration failed"}\n${usage}`);
    return 2;
  }
}
