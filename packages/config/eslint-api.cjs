const base = require('./eslint-base.cjs');

/** @type {import('eslint').Linter.Config} */
module.exports = {
  ...base,
  plugins: [...base.plugins, 'boundaries'],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
    'boundaries/elements': [
      {
        type: 'common',
        pattern: 'src/common/**/*',
        mode: 'full',
      },
      {
        type: 'module',
        pattern: 'src/modules/*/**/*',
        mode: 'full',
        capture: ['moduleName'],
      },
      {
        type: 'app-root',
        pattern: 'src/*',
        mode: 'file',
      },
    ],
    'boundaries/ignore': ['**/*.spec.ts', '**/*.test.ts', 'src/test-fixtures/**/*'],
  },
  rules: {
    ...base.rules,
    'boundaries/element-types': [
      'error',
      {
        default: 'allow',
        message: '${file.type} tidak diizinkan mengimpor ${target.type}',
        rules: [
          {
            from: 'common',
            disallow: ['module'],
            message: 'Pelanggaran modular monolith: common/ dilarang mengimpor dari modules/.',
          },
          {
            from: 'module',
            disallow: [
              [
                'module',
                {
                  moduleName: '!${from.moduleName}',
                },
              ],
            ],
            message:
              "Pelanggaran modular monolith: modul '${from.moduleName}' dilarang mengimpor langsung dari modul '${target.moduleName}'. Gunakan public service atau event domain.",
          },
        ],
      },
    ],
  },
};

