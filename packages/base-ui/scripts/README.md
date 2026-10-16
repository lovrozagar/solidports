# Scripts

Maintenance scripts for the Base UI Solid port. The port's own scripts check test parity with upstream (`test-parity.mjs`, `browser-parity.mjs`, `compare-regressions.mjs`), run every CI suite locally (`test-all.mjs`), and generate the Solid docs (`docs/`). The rest come from upstream Base UI: `inlineScripts.mts`, the `eslint/` and `stylelint/` rules and `changelog.config.mjs`. Releases do not run from here: a `base-ui-v<version>` tag publishes `@solidports/base-ui` through the repository's release workflow.

- What each script does and what runs it: [`../context/tooling/scripts.md`](../context/tooling/scripts.md)
- How a release works: [`../context/tooling/release.md`](../context/tooling/release.md)
- The docs pipeline: [`docs/README.md`](docs/README.md)
