import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import jest from 'eslint-plugin-jest'

/**@type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['prisma/generated/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: { sourceType: 'script' },
  },
  {
    languageOptions: {
      globals: { process: true, __dirname: true },
    },
  },
  {
    rules: {
      'semi': ['error', 'never'],
      'indent': ['error', 2],
      'no-multi-spaces': 'error',
      'no-trailing-spaces': 'error',
      'no-inline-comments': 'error',
      'spaced-comment': ['error', 'never'],
      'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 1, 'maxBOF': 0 }],
      'quotes': ['error', 'single', { 'avoidEscape': true, 'allowTemplateLiterals': true }],
      'no-restricted-syntax': [
        'error',
        {
          'selector': 'BlockComment',
          'message': 'Block comments are not allowed.'
        }
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: { sourceType: 'module' },
    plugins: { jest },
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error',
    }
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
] 