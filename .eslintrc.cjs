const baseConfig = require('./packages/config/eslint-base.cjs');

/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...baseConfig,
  rules: {
    ...baseConfig.rules,
    'no-console': 'off',
  },
};

