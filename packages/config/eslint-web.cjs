const base = require('./eslint-base.cjs');

/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...base,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: [
    ...base.extends,
    'next/core-web-vitals',
  ],
  rules: {
    ...base.rules,
    '@next/next/no-html-link-for-pages': 'off',
  },
};

