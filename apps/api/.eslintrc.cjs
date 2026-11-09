const apiConfig = require('@sistem-terintegrasi/config/eslint-api.cjs');

module.exports = {
  ...apiConfig,
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
};

