module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:import/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'import/order': 'off',
    'import/no-unresolved': ['error', { ignore: ['^node:'] }],
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
  },
  plugins: ['simple-import-sort'],
}
