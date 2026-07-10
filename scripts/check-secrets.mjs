import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';

const patterns = [
  /sk-[A-Za-z0-9]{20,}/,
  /BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY/,
  /password\s*[:=]\s*['"][^'"\n]{12,}/i,
  /Bearer\s+[A-Za-z0-9._-]{20,}/,
];

const files = glob('**/*', {
  exclude: (name) =>
    name.includes('node_modules') || name.includes('.git') || name.startsWith('.env'),
});
let failures = 0;
for await (const file of files) {
  try {
    const content = await readFile(file, 'utf8');
    if (patterns.some((pattern) => pattern.test(content))) {
      console.error(`Potential secret pattern found in ${file}`);
      failures += 1;
    }
  } catch {
    // Binary files and unreadable paths are ignored by this lightweight pre-commit check.
  }
}
process.exitCode = failures === 0 ? 0 : 1;
