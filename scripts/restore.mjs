import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

if (process.env.RESTORE_CONFIRM !== 'licensed_resource_search') {
  throw new Error('Set RESTORE_CONFIRM=licensed_resource_search to acknowledge target replacement');
}
if (!process.env.BACKUP_ENCRYPTION_PASSPHRASE) {
  throw new Error('BACKUP_ENCRYPTION_PASSPHRASE is required');
}
const input = process.argv[2];
if (!input) throw new Error('Encrypted backup path is required');
const user = process.env.POSTGRES_USER ?? 'app';
const database = process.env.POSTGRES_DB ?? 'licensed_resource_search';
const decrypt = spawn(
  'openssl',
  [
    'enc',
    '-d',
    '-aes-256-cbc',
    '-pbkdf2',
    '-pass',
    'env:BACKUP_ENCRYPTION_PASSPHRASE',
    '-in',
    resolve(input),
  ],
  { stdio: ['ignore', 'pipe', 'inherit'], env: process.env },
);
const restore = spawn(
  'docker',
  [
    'compose',
    'exec',
    '-T',
    'postgres',
    'pg_restore',
    '-U',
    user,
    '-d',
    database,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
decrypt.stdout.pipe(restore.stdin);
const exitCode = await new Promise((resolveExit) => restore.once('close', resolveExit));
if (exitCode !== 0 || decrypt.exitCode !== 0) throw new Error('Database restore failed');
console.log(JSON.stringify({ event: 'restore.completed', input: resolve(input) }));
