---
tags: [upstream, sync, snapshot, workflow]
sources: [packages/base-ui/scripts/docs/sync-docs-react.mjs, packages/base-ui/scripts/docs/generate.mjs, packages/base-ui/scripts/test-parity.mjs, packages/base-ui/scripts/browser-parity.mjs, packages/base-ui/scripts/test-all.mjs, packages/base-ui/packages/react, packages/base-ui/packages/utils, packages/base-ui/docs/docs-infra]
verified: 2026-10-16
---

# Upstream sync

Moving the port to a new `@base-ui/react` version: replace the three snapshots, regenerate and validate the docs, then let test parity list the upstream changes and port each one test-first.

## Snapshots

| Snapshot | Source | How |
| :--- | :--- | :--- |
| `packages/base-ui/packages/react` | `mui/base-ui@<tag>` `packages/react` | copy by hand (no script) |
| `packages/base-ui/packages/utils` | `mui/base-ui@<tag>` `packages/utils` | copy by hand (no script) |
| `packages/base-ui/docs/react` | `mui/base-ui@<tag>` `docs/` | `docs:sync` |
| `packages/base-ui/docs/docs-infra` | mui-public at the commit that published the docs' `@mui/internal-docs-infra` | `docs:sync` |

Never edit a snapshot to match Solid. The previous bump (117b8393, v1.9.0) shows the shape of the commit.

## Steps

All commands from `packages/base-ui` unless marked root.

1. Note the current tag (`docs/react/.upstream-tag`, today `v1.9.0`) so you can diff old against new.
2. Replace `packages/react` and `packages/utils` with the new tag's trees. Keep the old tree reachable in git to diff it.
3. Docs snapshot: `DOCS_TAG=v<x.y.z> bun run docs:sync`. For a permanent bump, change the `TAG` default in `scripts/docs/sync-docs-react.mjs` (and its `/tmp/base-ui-v1.9.0` cache special case). When the new docs depend on another `@mui/internal-docs-infra` version, the script exits; update `DOCS_INFRA_VERSION` and `DOCS_INFRA_COMMIT` together (see [docs pipeline](../tooling/docs-pipeline.md)). `DOCS_UPSTREAM_CACHE` points at an existing clone. The script also runs `extract-error-codes`.
4. `bun install` at the root.
5. `bun run docs:generate`. Each `FAIL <file>: <error>` is a transform gap: add a failing case to `scripts/docs/react-to-solid.test.mjs`, fix `react-to-solid.mjs` or `templates/`, regenerate. A new section whose library has no Solid 2 version goes in `scripts/docs/excluded.mjs` with its reason.
6. `bun run docs:validate`, then `bun run docs:api` if only the API tables need rewriting. Commit what they write.
7. docs-infra runtime: diff `docs/docs-infra/src` (old against new) for the hand-written entries listed in `scripts/docs/README.md`, and port each change into `scripts/docs/templates/docs-infra/src` with a failing test beside the module first.
8. Test parity: `node scripts/test-parity.mjs` (add `--json <file>` for the full report). It lists upstream test files with no Solid counterpart, test titles missing in the Solid file, and `skipIf` skips where upstream runs the test.
9. Port source changes test-first: for each upstream change (`git diff` of `packages/react/src` and `packages/utils/src`), port its tests first, run them red, then port the code until they pass. Follow [port a component](port-a-component.md) for new components.
10. Run `bun run extract-error-codes` and `bun run inline-scripts` when error messages or `*.template.js` scripts changed; CI fails if either changes the tree.
11. Browser parity: `bun run test:base-ui:all --only parity-firefox,parity-webkit` (root) runs upstream's and the Solid suite in each browser and fails on confirmed Solid-only failures (`scripts/browser-parity.mjs`). Chromium parity runs on a `workflow_dispatch` of `base-ui-browser-parity.yml`.
12. Everything: `bun run test:base-ui:all` (root). Report passed, failed and not run.
13. Version: set `packages/base-ui/packages/solid/package.json` to `<x.y.z>-1` and update the version mentioned in `packages/base-ui/AGENTS.md`, `packages/base-ui/README.md` and the package CHANGELOG. Release follows [release](../tooling/release.md).

## Watch for

- The transform is heuristic; a new React idiom in the docs shows up as a `FAIL` line, a typecheck error in `docs/solid` (`bun run typescript --noEmit` there), or a hydration miss in `docs:check-hydration --serve`.
- Test parity matches titles, so a renamed upstream test appears as missing; rename the Solid test to match.
- New upstream test helpers under `packages/react/test` need Solid counterparts under `packages/solid/test`; test parity checks that tree pair too.
- Testing environment details: [parity](../testing/parity.md), [suites](../testing/suites.md).
