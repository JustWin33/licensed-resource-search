import { spawn } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('run-with-env requires a command');

const child = spawn(command, args, {
  env: process.env,
  stdio: 'inherit',
});

child.once('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
