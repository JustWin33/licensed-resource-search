import tseslint from 'typescript-eslint';

export default [
  ...tseslint.configs.recommended,
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/coverage/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    rules: {
      'no-console': 'warn',
    },
  },
  {
    files: [
      'apps/worker/src/main.ts',
      'packages/core/src/admin-create.ts',
      'packages/db/prisma/seed.ts',
      'packages/search/src/benchmark.ts',
      'packages/search/src/smoke.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
];
