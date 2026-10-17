import solid from 'eslint-plugin-solid/configs/typescript';
import { defineConfig } from 'eslint/config';
// eslint-disable-next-line import/no-relative-packages
import rootConfig from '../../eslint.config.mjs';

// The perf harness under the Base UI root config (upstream's), whose file patterns are written from
// the Base UI root: ESLint resolves this config for files under `test/perf-solid`, so its entries
// keep the root as their base path, as `packages/solid/eslint.config.mjs` does.
const baseConfig = rootConfig.map((config) => ({ basePath: '../..', ...config }));

const reactRulesOff = Object.fromEntries(
  rootConfig
    .flatMap((config) => Object.keys(config.rules ?? {}))
    .filter((ruleName) => ruleName.startsWith('react'))
    .map((ruleName) => [ruleName, 'off']),
);

/** The Solid side's fixtures, which the Solid compiler builds; `react/**` keeps the React rules. */
const SOLID_FILES = ['solid/**/*.{ts,tsx}', 'ssr/solid/**/*.{ts,tsx}'];

export default defineConfig(
  ...baseConfig,
  {
    // The harness is Node scripts and page drivers, not library code: three library rules work
    // against what it does.
    rules: {
      // The scripts report their results on stdout.
      'no-console': 'off',
      // Steps, runs and cycles run one after another on purpose: each `await` in a loop is the
      // measurement's order (an interaction, then a yield to the browser), never a missed batch.
      'no-await-in-loop': 'off',
      // The pages expose `__bench*` hooks to the harness, a name no app code can collide with.
      'no-underscore-dangle': 'off',
    },
  },
  {
    ...solid,
    files: SOLID_FILES,
  },
  {
    files: SOLID_FILES,
    rules: reactRulesOff,
  },
);
