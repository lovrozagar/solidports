---
tags: [testing, debugging, workflow, gates]
sources: [packages/base-ui/packages/solid/vitest.config.mts, packages/base-ui/packages/solid/vitest.ssr.config.mts, packages/base-ui/packages/solid/test, packages/base-ui/scripts/browser-parity.mjs, packages/base-ui/scripts/test-all.mjs, packages/base-ui/package.json]
verified: 2026-10-16
---

# Fix a failing test

A red test in any Base UI suite is the only work until it is green: reproduce it in its environment, compare it with upstream's run of the same test, find the cause in the Solid code (or in the test's port), fix it, and rerun every gate.

## Rule

A failure is never skipped, retried away, or called flaky (`.claude/rules/standards.md`, `.rulesync/reference/gates.md`). Do not add `.skip`, a new `skipIf`, a longer timeout to hide a race, or a rerun loop. `browser-parity.mjs` lists Solid-only failures it could not confirm on rerun as "flaky"; treat each one as a failure to reproduce, not a pass. The same rule covers a test that only fails in CI.

## 1. Reproduce

From `packages/base-ui`, run only the failing environment first:

| Failing in | Command |
| :--- | :--- |
| jsdom (`@solidports/base-ui`, `:ssr`, docs) | `bun run test:solid:jsdom <file-or-name> --run --reporter=agent` |
| Chromium | `bun run test:solid:chromium <file-or-name> --run --reporter=agent` |
| Firefox / WebKit | `bun run test:solid:firefox …` / `bun run test:solid:webkit …` |
| Interactive browser | `bun run test:solid:chromium:ui` |
| A CI suite (e2e, regressions, docs, package) | `bun run test:base-ui:all --only <suite>` from the root (`--list` names them); logs in `.tmp/base-ui-test-all/<suite>.log` |

Notes:

- `test:solid:*` runs four projects: `@solidports/base-ui` (jsdom or browser by `VITEST_ENV`, hydratable output), `@solidports/base-ui:ssr` (`test/ssr`, Node), `@solidports/docs` and `@solidports/docs:dom`.
- Hydration tests (`test/hydration/*.hydration.test.tsx`) hydrate HTML that `test/hydration/globalSetup.ts` server-rendered before the run; a fixture change needs a fresh run.
- `test/package/**` runs only in jsdom; it reads the built `types/`, so run `bun run types` in `packages/solid` first, as CI does.
- Regression screenshot failures upload `test/regressions-solid/screenshots` as a CI artifact.

## 2. Compare with upstream

The Solid test should match an upstream test with the same title at the same relative path under `packages/react/src` (or `packages/react/test`). Run upstream's version in the same environment: `bun run test:jsdom <name> --run` or `bun run test:chromium <name> --run`.

- Upstream passes, Solid fails: the port's bug, in the source or in the test's port. Diff the two test files first; a dropped `await`, a missing `act()` around a direct DOM call, or a changed assertion shows up there.
- Both fail in that browser: the environment's failure. It still blocks; check whether upstream's CI runs that browser (only Chromium) and record what you find.

## 3. Classify

| Symptom | Where to look |
| :--- | :--- |
| Assertion sees the old DOM right after a write | Writes batch on a microtask; the read needs `flush()` (`act` from `#test-utils` calls it). See [reactivity](../solid/reactivity.md). |
| Environment-specific behavior (jsdom gaps, focus, pointer, animations, iframes, matchers) | [testing quirks](../testing/quirks.md) |
| Ref missing, handler not firing, wrong event order | [refs and events](../solid/refs-and-events.md) |
| Element rebuilt instead of updated, attribute string mismatch | [gotchas](../solid/gotchas.md), [render pipeline](../architecture/render-pipeline.md) |
| Open/close timing, `data-starting-style`/`data-ending-style` | [transitions](../architecture/transitions.md) |
| Popup position or dismissal | [floating](../architecture/floating.md) |
| Server output or hydration key miss | [SSR and hydration](../architecture/ssr-hydration.md) |
| Count or budget assertion in `*.cost.test.tsx` | [primitive costs](../solid/primitive-costs.md) |
| Test missing or skipped against upstream | [parity](../testing/parity.md) |

The component's note under `components/` may already record the behavior.

## 4. Fix, test-first

1. When the existing test does not isolate the cause, write a smaller failing test that does and watch it fail for the named reason.
2. Make the smallest source change that passes it. Change the test only when its port deviates from upstream; keep the upstream title.
3. Rerun the failing environment, then the others for the same file (at least jsdom and Chromium).

## 5. Gates

- `node scripts/test-parity.mjs` (no new skip or missing title).
- From the root: `bun run verify` on a committed tree, then `bun run test:base-ui:all`. Report passed, failed and not run; a suite that did not run is not a pass.

Record a new cross-cutting pitfall in [gotchas](../solid/gotchas.md) and a component-specific one in its note under `components/`. Suite map: [suites](../testing/suites.md).
