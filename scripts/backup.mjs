import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

if (!process.env.BACKUP_ENCRYPTION_PASSPHRASE) {
  throw new Error('BACKUP_ENCRYPTION_PASSPHRASE is required');
}
const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const output = resolve(process.argv[2] ?? `backups/licensed-resource-search-${timestamp}.dump.enc`);
mkdirSync(dirname(output), { recursive: true });
const user = process.env.POSTGRES_USER ?? 'app';
const database = process.env.POSTGRES_DB ?? 'licensed_resource_search';
const dump = spawn(
  'docker',
  ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', user, '-d', database, '-Fc'],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);
const encrypt = spawn(
  'openssl',
  [
    'enc',
    '-aes-256-cbc',
    '-pbkdf2',
    '-salt',
    '-pass',
    'env:BACKUP_ENCRYPTION_PASSPHRASE',
    '-out',
    output,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'], env: process.env },
);
dump.stdout.pipe(encrypt.stdin);
const exitCode = await new Promise((resolveExit) => encrypt.once('close', resolveExit));
if (exitCode !== 0 || dump.exitCode !== 0) throw new Error('Encrypted database backup failed');
console.log(JSON.stringify({ event: 'backup.completed', output }));
