---
tags: [lint, format, eslint, oxlint]
sources: [packages/base-ui/eslint.config.mjs, packages/base-ui/packages/solid/eslint.config.mjs, packages/base-ui/docs/solid/eslint.config.mjs, packages/base-ui/scripts/eslint/testRules.mjs, packages/base-ui/prettier.config.mjs, packages/base-ui/stylelint.config.mjs, packages/base-ui/.vale.ini, .oxlintrc.json, oxlint.base.json, .oxfmtrc.jsonc]
verified: 2026-10-17
---

# Lint and format

Base UI lints with upstream's ESLint 10 stack plus `eslint-plugin-solid`, while the root oxlint and oxfmt ignore `packages/base-ui/**`. The decided direction moves the Solid tree to oxlint, with custom rules in a repo-owned root `lint/` plugin.

## Today: Base UI tree

| Tool | Config | CI step (Linting job, `base-ui-tests.yml`) |
| :--- | :--- | :--- |
| ESLint 10.11 | `packages/base-ui/eslint.config.mjs` → `packages/solid/eslint.config.mjs` → `docs/solid/eslint.config.mjs` | `bunx eslint packages/solid/src packages/solid/test docs/solid/src --report-unused-disable-directives --max-warnings 0` |
| ESLint RuleTester | `scripts/eslint/testRules.test.mjs` | `bun run test:lint-rules` |
| stylelint 17 | `packages/base-ui/stylelint.config.mjs` | `docs/solid/**/*.css` only |
| Vale 3.24 | `packages/base-ui/.vale.ini` (MUI + Google styles) | `bun run valelint`: every tracked `.md`/`.mdx` except `docs/docs-infra`, error level |
| Prettier 3.9 | `packages/base-ui/prettier.config.mjs` (MUI `createBaseConfig`) | not checked |
| markdownlint-cli2 | `packages/base-ui/.markdownlint-cli2.mjs` (MUI `createBaseConfig`) | not run; the config fails to load because `@mui/internal-code-infra` 0.1.1-canary.6 exports no `./markdownlint` |

`scripts/` and `test/*-solid` are not linted in CI.

### ESLint layering

- Root (`packages/base-ui/eslint.config.mjs`): upstream's config. MUI `createBaseConfig` (`markdown: true`, `consistentTypeImports`), `createTestConfig`, `createDocsConfig`, Base UI overrides. Global ignores include `docs/docs-infra` and `scripts/docs/templates` (templates lint where they land, in `docs/solid`). It re-includes the base `no-restricted-syntax` entries in narrower overrides and throws when it extracts none.
- `packages/solid/eslint.config.mjs`: the root config with `basePath: '../..'`, upstream test-helper entries remapped to `packages/solid/test`, every `react*` rule off, `@typescript-eslint/naming-convention` warn, a "Base UI Solid tests" block (`base-ui-test/*` rules, `no-restricted-imports` steering to `#test-utils`), then `eslint-plugin-solid/configs/typescript` with `solid/reactivity` off for the library.
- `docs/solid/eslint.config.mjs`: written by `generate.mjs`. The Solid package config plus the root config's `docs/react` entries remapped to `docs/solid`, `react*` and `@next/*` off, `solid/reactivity` warn, `solid/self-closing-comp` off.
- `scripts/eslint/testRules.mjs` (upstream): six test rules, `wait-for-single-expect`, `no-event-init-spies`, `no-tests-in-foreach`, `no-flush-after-render`, `no-chai-style`, `no-standalone-user-event-setup`.

The Solid-side `no-restricted-imports` root pattern targets `@base-ui/react/...` and never matches Solid imports.

## Today: repo root (standards)

- `oxlint.base.json` (managed by `~/Development/standards`): plugins `typescript`, `unicorn`, `oxc`; `correctness` error, `suspicious` warn.
- `.oxlintrc.json` (repo-owned): extends the base, ignores `packages/base-ui/**` and `packages/recharts/**`. Root `lint` is `oxlint --config .oxlintrc.json scripts`.
- `.oxfmtrc.jsonc` (managed): tabs, `printWidth` 120, `semi: false`, double quotes; ignores `packages/base-ui/**`, `packages/recharts/**`.
- oxlint 1.88.0 and oxfmt 0.73.0 (root `devDependencies`). lefthook pre-commit runs `oxlint --fix`, `oxfmt` and their checks on staged files; Base UI files fall under the ignores, and the `base-ui-eslint` job lints the staged Base UI Solid files with ESLint instead. See [standards](standards.md).

## Direction: oxlint for the Solid tree

Decided: the Solid tree (`packages/solid`, `docs/solid`, the port's scripts) moves from ESLint to oxlint, with custom rules as JavaScript plugin rules in a repo-owned root `lint/` plugin, modeled on flare's `packages/core/lint`. The folder does not exist yet.

- Flare pattern: one rule per file exporting `rule`; a colocated test that runs real oxlint on a temporary `.oxlintrc.json`; one aggregating module registers every rule under one plugin name (oxlint registers one name per specifier); the package config lists it in `jsPlugins`; root `lint` gains a second oxlint run.
- Rule candidates: banned imports (`react`, `react-dom`, `solid-js/web`, `@testing-library/react`), `createEffect` arity, no `.only`/`.skip`, `skipIf` reason, no signal setter inside effects, `{ current }` refs with a ratchet, the 11 shared `no-restricted-syntax` selectors.
- Each rule ships with failing RuleTester cases first (TDD rule, `.rulesync/reference/tdd.md`). `testRules.test.mjs` passes under oxlint's `RuleTester` (`oxlint/plugins-dev`) with only the import changed.

### Feasibility numbers

Local measurement, ESLint configs at 27e77167, ESLint 10.11, oxlint 1.86, 2026-10-14:

- 221 distinct effective rules: 159 native oxlint, 52 load unchanged as JavaScript plugins (solid 15, testing-library 21, mui 9, base-ui-test 6, compat 1), 8 have no equivalent, 2 native only with `--type-aware` (`consistent-return`, `dot-notation`).
- Effective rules per file: src `.tsx` 174, `.test.tsx` 203, docs `.tsx` 169.
- Wall time: ESLint 43.8 s, oxlint with JavaScript plugins 3.0 s (about 93% in JavaScript plugins), native only 0.2 s.
- src + test: ESLint 0 findings; oxlint 40, all native-rule findings (16 `vitest/prefer-importing-vitest-globals`, 14 `vitest/no-conditional-expect`, 7 jsx-a11y, 2 `no-unsafe-optional-chaining`, 1 `vitest/expect-expect`). 5 of 195 `eslint-disable` comments become unused.
- oxfmt with Prettier-matching options rewrites 63 src files (481 lines), mostly union leading `|`, and 306 docs files.

Drift since 27e77167: `packages/solid/eslint.config.mjs` is unchanged and the root config changed only its global ignores, so the src/test figures stand. `docs/solid/eslint.config.mjs` was rewritten (generated, derived from the root config's docs entries instead of `createDocsConfig`) and the docs were regenerated, so every docs figure needs re-measuring. The ESLint and stylelint baselines that failed on 2026-10-14 pass at b9b813c9.

### Risks

1. JavaScript plugins are alpha: one crashing rule drops every JavaScript rule for that file.
2. `mui/no-floating-cleanup` needs type information; loaded as a JavaScript plugin it throws on 1,094 files. Port it without types or drop it; tsgolint (`--type-aware`) cannot run custom rules.
3. MDX, JSON and Markdown linting is lost unless a narrow ESLint or remark config stays.
4. The 8 unmapped rules: port `no-restricted-syntax` as custom rules; port or drop `import/no-relative-packages`, `naming-convention`, `consistent-this`; drop `import/order`, `spaced-comment`, `no-octal`, `global-require`.
5. oxlint rejects `settings.react.version: "detect"`; `compat` needs browserslist settings.
6. JavaScript plugins cost about 2.8 of 3.0 s; bundle them.
7. `--type-aware` adds `oxlint-tsgolint` and needs TS7-compatible tsconfigs.
8. oxfmt on Solid sources drifts from the mirrored `packages/react` layout; scope it to Solid-owned paths.

CI changes when it lands: the Linting job's `eslint` and `eslint rule tests` steps, `scripts/test-all.mjs` suites `eslint` and `eslint-rule-tests`, and `test:lint-rules`. Upstream's `eslint`/`eslint:ci` scripts stay. Record the switch in the [decision log](../decisions/log.md).
