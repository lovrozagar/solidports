---
tags: [layout, snapshot, generated, exports]
sources: [packages/base-ui/AGENTS.md, packages/base-ui/packages/solid/package.json, packages/base-ui/packages/solid/tsconfig.build.json, packages/base-ui/scripts/docs/generate.mjs, packages/base-ui/scripts/docs/README.md, packages/base-ui/scripts/docs/templates, packages/base-ui/packages/solid/test]
verified: 2026-10-16
---

# Fork layout

The fork holds upstream snapshots (read only), two living trees (`packages/solid` and `scripts/docs`), and generated output (`docs/solid`, `packages/solid/types/`). Edit living trees and generator inputs; never edit snapshots or generated files.

## Trees by ownership

All paths are relative to `packages/base-ui/`.

| Path | Kind | What it is |
| :--- | :--- | :--- |
| `packages/react/` | Snapshot | `@base-ui/react` 1.9.0 source. The upstream reference for every port. |
| `packages/utils/` | Snapshot | `@base-ui/utils`. Also a generator source for the docs (`base-ui-utils`). |
| `docs/react/` | Snapshot | `mui/base-ui` `docs/` at `.upstream-tag`, copied by `docs:sync` (`scripts/docs/sync-docs-react.mjs`). |
| `docs/docs-infra/` | Snapshot | `@mui/internal-docs-infra` source; `.upstream-commit` names the `mui/mui-public` commit. |
| `packages/solid/` | Living | `@solidports/base-ui`, the only living library. |
| `scripts/docs/` | Living | The docs generator: `generate.mjs`, `react-to-solid.mjs`, `excluded.mjs`, `check-hydration.mjs`, `templates/`. |
| `docs/solid/` | Generated | The Solid docs app, written file for file from `docs/react`. |
| `packages/solid/types/` | Generated | Declarations from `bun run types`; gitignored (`packages/solid/.gitignore`). |

Snapshots are replaced whole on a version bump, never edited to match Solid (see [upstream sync](../workflows/upstream-sync.md)). The scope rules are in `packages/base-ui/AGENTS.md` and the root `AGENTS.md`.

## Generated paths

- `docs/solid/**` (1246 tracked files). `generate.mjs` writes it from `docs/react` (`src`, `public`, `scripts`, `postcss.config.js`, `next.config.mjs`), rewrites only changed files, and prunes stale ones. It does not own `node_modules`, `dist`, or `.output`.
  - Pages land in `docs/solid/src/app/(docs)/solid/` (route rename from `(docs)/react/`).
  - `docs/solid/docs-infra/` and `docs/solid/base-ui-utils/` are generated from the `docs/docs-infra` and `packages/utils` snapshots (`SOURCE_PACKAGES` in `generate.mjs`).
  - `docs:validate` writes API tables (`types.md`) and page indexes into the tree; commit what it writes, because CI fails on a diff.
- `packages/solid/types/**`. `tsc -p tsconfig.build.json` emits declarations only, then `scripts/addDeclarationExtensions.mjs` adds explicit extensions so `node16`/`nodenext` consumers resolve them. `prepack` runs it.

A wrong docs page is a generator bug: fix `react-to-solid.mjs` or `templates/`, then run `bun run docs:generate` and `bun run docs:validate`. To drop a page or section, add it with a reason to `excluded.mjs`. Details are in [docs pipeline](../tooling/docs-pipeline.md).

## Hand-kept generator inputs

Everything under `scripts/docs/templates/` is hand-written and copied over the generated output:

- `framework/`: the Vite app shell that replaces the Next.js App Router (`App.tsx`, `Document.tsx`, `routes.tsx`, `vite.ts`, `metadata.ts`, `build.mjs`, `docs-infra.mjs`).
- `src/adapters/`: stand-ins for `next/*` and React runtime APIs (the `MODULES` map in `generate.mjs` points imports at them).
- `docs-infra/src/`: the docs-infra runtime (hooks and components pages render with) rewritten for Solid. A module there replaces the docs-infra module at the same path; what it imports is generated. On a docs-infra bump, diff `docs/docs-infra/src` and port the changes by hand.
- Root config files (`vite.config.ts`, `vitest.config.mts`, `vitest.dom.config.mts`, `tsconfig.json`, `types.d.ts`).

## Package exports model

`packages/solid/package.json` ships uncompiled source plus prebuilt declarations:

```json
".": { "types": "./types/index.d.ts", "solid": "./src/index.ts", "default": "./src/index.ts" }
```

- All 80 subpaths (components, `./merge-props`, `./use-render`, 34 `./internals/*`) repeat this three-condition shape.
- `solid` and `default` resolve to `src/*.ts(x)`; the consumer's Solid compiler compiles the JSX (`jsx: preserve`, `jsxImportSource: @solidjs/web`).
- `types` resolves to `types/`, so the published package needs `bun run types` first.
- `files` ships `src` and `types`, minus tests, specs, `*.ssr-fixtures.*`, `test-utils.*`, and stray `.d.ts`.
- Private import aliases: `#test-utils` (`test/index.ts`), `#utils/*` (`src/utils/*.ts`), `#formatErrorMessage`.
- Peer range: `solid-js`, `@solidjs/web`, `@solidjs/signals` `~2.0.0-rc.13`; the root catalog and `bun.lock` pin rc.15.
- `scripts/validateBuiltTypes.mjs` (`test:built-types`) and `test:package` (publint, attw) check the shipped shape.

## Test trees

| Path | Contents |
| :--- | :--- |
| `packages/solid/src/**/*.test.tsx` | Unit tests, colocated, mirrored title for title from `packages/react`. |
| `packages/solid/test/` | Shared harness (`createRenderer.ts`, `setupSolid.ts`, conformance helpers), plus `conformanceTests/`, `floating-ui-tests/`, `describeGregorianAdapter/`, `hydration/`, `ssr/`, `package/`. |
| `test/e2e-solid/` | The `test/e2e` fixtures rendered with Solid; upstream Playwright specs run unchanged. |
| `test/regressions-solid/` | Visual regressions, Solid against React, with `accepted.json`. |
| `test/perf-solid/` | Solid vs React benchmark (`bench:solid`, `bench:solid:ssr`), `known-differences.json`. |
| `test/screen-reader-solid/` | Screen reader Playwright config. |
| `test/public-types-solid/` | `tsc --noEmit` over public type usage. |
| `test/node-resolution-solid/` | Package resolution from Node. |

The sibling `test/*` folders without `-solid` are upstream snapshots. Suite commands and CI mapping are in [test suites](../testing/suites.md); hydration and SSR tests are in [SSR and hydration](ssr-hydration.md).
