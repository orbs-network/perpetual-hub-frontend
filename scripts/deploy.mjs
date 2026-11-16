import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
export const DEPLOY_TARGET = Object.freeze({
  projectId: 'prj_RuNXiM0iYR0PRNn47ElA3M46GsLS',
  orgId: 'team_t6YZC010wIUd8yFGN6mkglL9',
});
const publicKeys = ['VITE_PARTNER', 'VITE_APP_ORIGIN', 'VITE_WALLETCONNECT_PROJECT_ID'];
const excludedDirectories = new Set([
  '.git', '.vercel', 'node_modules', 'dist', 'dist-ssr', 'coverage',
  '.playwright-cli', 'playwright-report', 'test-results',
]);

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const capture = options.encoding === 'utf8';
    const child = spawn(command, args, { ...options, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let stdout = '';
    let commandError;
    if (capture) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; });
    }
    child.once('error', error => {
      commandError = error;
      if (child.pid === undefined) reject(error);
    });
    child.once('close', (status, exitSignal) => {
      // Aborting emits an error before the process has stopped. Wait for close
      // before allowing staging cleanup or logout to begin.
      if (commandError) reject(commandError);
      else if (status === 0) resolve(stdout);
      else reject(Object.assign(new Error(`${command} failed${exitSignal ? ` (${exitSignal})` : ''}`), { status }));
    });
  });
}

async function readEnvironment(file) {
  try { return parseEnv(await readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function applicationEnvironment(root, env, stage) {
  const local = await Promise.all(
    ['.env.production.local', '.env.local', '.env.production', '.env']
      .map(file => readEnvironment(path.join(root, file))),
  );
  const remote = await readEnvironment(path.join(stage, '.vercel/.env.production.local'));
  const sources = [env, ...local, remote];
  const variables = {};
  for (const key of publicKeys) {
    const source = sources.find(candidate => typeof candidate[key] === 'string');
    const value = source?.[key];
    if (value === '[SENSITIVE]') throw new Error(`Set ${key} locally; its pulled Vercel value is redacted.`);
    variables[key] = value?.trim() ?? '';
  }
  for (const key of ['VITE_PARTNER', 'VITE_APP_ORIGIN']) {
    if (!variables[key]) throw new Error(`Set ${key} in your shell, a local environment file or Vercel production.`);
  }
  return variables;
}

export async function confirmDeployment({ input = process.stdin, output = process.stdout, signal } = {}) {
  if (signal?.aborted) return false;
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Production deployment requires an interactive terminal; use --dry-run or --build-only without publishing.');
  }
  return new Promise(resolve => {
    const prompt = createInterface({ input, output });
    const finish = confirmed => { resolve(confirmed); prompt.close(); };
    const abort = () => finish(false);
    prompt.once('close', () => {
      signal?.removeEventListener('abort', abort);
      resolve(false);
    });
    prompt.once('SIGINT', () => finish(false));
    signal?.addEventListener('abort', abort, { once: true });
    prompt.question(`Deploy frontend to PRODUCTION (${DEPLOY_TARGET.projectId})? (yes/no) [no]: `,
      answer => finish(['yes', 'y'].includes(answer.trim().toLowerCase())));
  });
}

/** Build current local source and publish only to this frontend's Vercel project. */
export async function deployFrontend(argv, {
  root = repoRoot,
  env = process.env,
  run = runCommand,
  confirm = confirmDeployment,
  log = console.log,
  signal,
} = {}) {
  if (argv.length === 1 && argv[0] === '--help') {
    log('Usage: npm run deploy -- [--dry-run|--build-only]\nDefault: confirm, build locally and publish to production with your Vercel CLI login.\n--dry-run: show the target/plan without commands or login.\n--build-only: pull production settings and save a local build without publishing.');
    return;
  }
  if (argv.length > 1 || argv.some(flag => !['--dry-run', '--build-only'].includes(flag))) {
    throw new Error('Use only --dry-run or --build-only; see --help.');
  }
  const buildOnly = argv.includes('--build-only');
  log(`Project: ${DEPLOY_TARGET.projectId} | Org: ${DEPLOY_TARGET.orgId}`);
  log(`Plan: public-source check → vercel pull --environment=production → merge public app env → vercel build --prod → ${buildOnly ? 'save local output' : 'vercel deploy --prebuilt --prod --archive=tgz'} → cleanup and vercel logout`);
  if (argv.includes('--dry-run')) return;
  if (!buildOnly && !await confirm({ signal })) { log('Deployment cancelled.'); return; }

  const commandEnv = { ...env };
  for (const key of Object.keys(commandEnv)) {
    if (key === 'VERCEL_TOKEN' || key.startsWith('VERCEL_TOKEN_') || key.startsWith('VITE_')) delete commandEnv[key];
  }
  commandEnv.VERCEL_PROJECT_ID = DEPLOY_TARGET.projectId;
  commandEnv.VERCEL_ORG_ID = DEPLOY_TARGET.orgId;
  commandEnv.NODE_ENV = 'production';
  const options = { cwd: root, env: commandEnv, signal };
  await run(process.execPath, ['scripts/check-public-boundary.mjs'], options);
  const files = (await run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    ...options, encoding: 'utf8',
  })).split('\0').filter(Boolean);

  let stage;
  let failed = false;
  try {
    try {
      await run('vercel', ['whoami', '--non-interactive'], options);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error.code === 'ENOENT') throw new Error('Install the Vercel CLI with npm install --global vercel.');
      log('Vercel login check failed. Starting Vercel login…');
      await run('vercel', ['login'], options);
      await run('vercel', ['whoami', '--non-interactive'], options);
    }

    stage = await mkdtemp(path.join(tmpdir(), 'perpetual-hub-deploy-'));
    for (const file of new Set(files)) {
      if (file.split('/').some(part => excludedDirectories.has(part)) ||
          path.basename(file).startsWith('.env') || file.endsWith('.tsbuildinfo')) continue;
      const relative = path.relative(root, path.resolve(root, file));
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('Source path escapes the repository.');
      }
      await mkdir(path.dirname(path.join(stage, relative)), { recursive: true });
      try { await cp(path.join(root, relative), path.join(stage, relative)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const vercel = (args, env = commandEnv) => run('vercel', args, { cwd: stage, env, signal });
    await vercel(['pull', '--yes', '--environment=production']);
    const project = JSON.parse(await readFile(path.join(stage, '.vercel/project.json'), 'utf8'));
    if (project.projectId !== DEPLOY_TARGET.projectId || project.orgId !== DEPLOY_TARGET.orgId ||
        ![undefined, null, '', '.'].includes(project.settings?.rootDirectory) ||
        ![undefined, null, 'vite'].includes(project.settings?.framework)) {
      throw new Error('Pulled Vercel project must match the configured project/org with repository root and Vite framework.');
    }
    const variables = await applicationEnvironment(root, env, stage);
    // Only supported public inputs enter Vite; discard unrelated pulled secrets
    // and stale VITE_* values before Vercel loads its production environment.
    await writeFile(path.join(stage, '.vercel/.env.production.local'),
      Object.entries(variables).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
    await vercel(['build', '--prod'], { ...commandEnv, ...variables });
    const output = path.join(stage, '.vercel/output');
    const config = JSON.parse(await readFile(path.join(output, 'config.json'), 'utf8'));
    await readFile(path.join(output, 'static/index.html'));
    let functions = [];
    try { functions = await readdir(path.join(output, 'functions')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (config.version !== 3 || functions.length) throw new Error('Expected a static Vercel v3 build with no server functions.');

    if (buildOnly) {
      const destination = path.join(root, '.vercel/local-builds/frontend');
      await rm(destination, { recursive: true, force: true });
      await cp(output, destination, { recursive: true });
      log(`Build saved to ${destination}; no deployment created.`);
    } else {
      await vercel(['deploy', '--prebuilt', '--prod', '--archive=tgz']);
    }
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (stage) {
      try { await rm(stage, { recursive: true, force: true }); }
      catch { cleanupErrors.push(`Remove temporary deployment files manually: ${stage}`); }
    }
    // Do not pass an aborted signal: logout must still run after cancellation.
    try { await run('vercel', ['logout'], { cwd: root, env: commandEnv }); }
    catch { cleanupErrors.push('Vercel logout failed; run vercel logout manually.'); }
    if (cleanupErrors.length) {
      if (failed) cleanupErrors.forEach(message => log(message));
      else throw new Error(cleanupErrors.join('\n'));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    await deployFrontend(process.argv.slice(2), { signal: controller.signal });
  } catch (error) {
    console.error(error.name === 'AbortError' ? 'Deployment interrupted.' :
      typeof error.status === 'number' ? `Deployment command failed (exit ${error.status}).` : error.message);
    process.exitCode = 1;
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}
