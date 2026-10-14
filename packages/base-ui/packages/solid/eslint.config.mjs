import { EXTENSION_TEST_FILE } from '@mui/internal-code-infra/eslint';
import solid from 'eslint-plugin-solid/configs/typescript';
import { defineConfig } from 'eslint/config';
// eslint-disable-next-line import/no-relative-packages
import rootConfig from '../../eslint.config.mjs';
// eslint-disable-next-line import/no-relative-packages
import baseUiTestRules from '../../scripts/eslint/testRules.mjs';

// The Base UI root config (upstream's) writes its file patterns from the Base UI root, such as
// `packages/*/src/**`. ESLint resolves this config for files under `packages/solid`, so its
// entries keep the root as their base path.
const baseConfig = rootConfig.map((config) => ({ basePath: '../..', ...config }));

// Upstream's test config also covers its shared test helpers (`packages/react/test/
// describeConformance.tsx`, `conformanceTests/*`, `*Tests.tsx`). The same entries cover the Solid
// package's helpers at the same paths.
const isReactTestHelperPattern = (pattern) =>
  typeof pattern === 'string' && pattern.startsWith('packages/react/test/');
const solidTestHelperConfig = rootConfig
  .filter((config) => config.files?.some(isReactTestHelperPattern))
  .map((config) => ({
    ...config,
    basePath: '../..',
    files: config.files.map((pattern) =>
      isReactTestHelperPattern(pattern)
        ? pattern.replace('packages/react/', 'packages/solid/')
        : pattern,
    ),
  }));

const reactRulesOff = Object.fromEntries(
  rootConfig
    .flatMap((config) => Object.keys(config.rules ?? {}))
    .filter((ruleName) => ruleName.startsWith('react'))
    .map((ruleName) => [ruleName, 'off']),
);

export default defineConfig(
  ...baseConfig,
  ...solidTestHelperConfig,
  {
    rules: {
      ...reactRulesOff,
      '@typescript-eslint/no-namespace': 'off',

      /**
       * TODO: Rules are disabled in order to allow exported clientOnly variables
       * to be named appropriately.
       */
      'no-underscore-dangle': 'off',
    },
  },
  {
    // The TypeScript plugin is registered for TypeScript files only.
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: ['function', 'variable'],
          leadingUnderscore: 'allow',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
      ],
    },
  },
  {
    // Upstream's "Base UI React tests" block, for the Solid package's tests.
    name: 'Base UI Solid tests',
    files: [
      `**/*${EXTENSION_TEST_FILE}`,
      'test/describeConformance.tsx',
      'test/conformanceTests/*.tsx',
      'test/*Tests.tsx',
    ],
    plugins: {
      'base-ui-test': baseUiTestRules,
    },
    rules: {
      // Assumes the async `#test-utils` renderer: awaiting a synchronous renderer flushes nothing.
      'base-ui-test/no-flush-after-render': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mui/internal-test-utils',
              importNames: ['createRenderer', 'describeConformance'],
              message:
                "Import from '#test-utils': its `render` is async and wrapped in act, and its conformance suite is the Base UI one.",
            },
          ],
          patterns: [
            {
              group: ['@solidports/base-ui/*/*'],
              message:
                'Prefer one level nested imports to avoid bundling everything in dev mode or breaking CJS/ESM split.',
            },
            {
              regex: '(^|/)test/(createRenderer|describeConformance)$',
              message: "Import test utilities from '#test-utils'.",
            },
          ],
        },
      ],
    },
  },
  solid,
);
