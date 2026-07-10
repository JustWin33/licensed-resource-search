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
];
