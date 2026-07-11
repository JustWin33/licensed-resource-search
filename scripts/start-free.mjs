import { spawn, spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('pnpm', ['db:migrate']);
run('pnpm', ['db:seed']);
run('pnpm', ['admin:bootstrap']);

const web = spawn('node', ['apps/web/node_modules/next/dist/bin/next', 'start', 'apps/web'], {
  stdio: 'inherit',
  env: process.env,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => web.kill(signal));
}

web.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
