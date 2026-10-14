// The Solid docs lint as upstream lints its React docs (`docs/react` in the root config): the
// Solid package's config, then upstream's docs config and docs rules. React-only rules stay off.
import { createDocsConfig, EXTENSION_TS } from '@mui/internal-code-infra/eslint';
import { defineConfig } from 'eslint/config';
// eslint-disable-next-line import/no-relative-packages
import solidConfig from '../../packages/solid/eslint.config.mjs';

const docsConfig = defineConfig(
  ...solidConfig,
  {
    name: 'MUI ESLint config for docs',
    files: [`**/*${EXTENSION_TS}`],
    extends: createDocsConfig(),
    rules: {
      '@typescript-eslint/no-use-before-define': 'off',
      'import/extensions': [
        'error',
        // Ignores extensions in package imports as well as local ts/tsx imports but .mjs is always required
        'ignorePackages',
        {
          ts: 'never',
          tsx: 'never',
          mjs: 'always',
        },
      ],
    },
  },
  {
    files: [`src/demos/solid/utils/use-render/**/*${EXTENSION_TS}`],
    rules: {
      'jsx-a11y/control-has-associated-label': 'off',
    },
  },
);

// `createDocsConfig` brings React's and Next.js's rules back; the Solid docs are a Solid app.
const nonSolidRulesOff = Object.fromEntries(
  docsConfig
    .flatMap((config) => Object.keys(config.rules ?? {}))
    .filter((ruleName) => ruleName.startsWith('react') || ruleName.startsWith('@next/'))
    .map((ruleName) => [ruleName, 'off']),
);

export default defineConfig(...docsConfig, {
  rules: {
    ...nonSolidRulesOff,
    // Demos and docs code are application code, the code `solid/reactivity` is written for.
    'solid/reactivity': 'warn',
  },
});
