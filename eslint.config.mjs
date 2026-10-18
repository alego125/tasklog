import js from '@eslint/js'
import globals from 'globals'
export default [
  { ignores: ['dist/**', 'node_modules/**', '.agents/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: { 'no-unused-vars': 'off' },
  },
  { files: ['server/**/*.js'], languageOptions: { sourceType: 'commonjs' } },
]
