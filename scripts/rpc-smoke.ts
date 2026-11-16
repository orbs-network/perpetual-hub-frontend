import { runRpcSmokeCLI } from "./rpc-smoke-cli";

process.exitCode = await runRpcSmokeCLI(process.argv.slice(2));
