---
tags: [testing, flush, jsdom, ssr]
sources: [packages/base-ui/packages/solid/test/setupSolid.ts, packages/base-ui/packages/solid/test/createRenderer.ts, packages/base-ui/packages/solid/test/act.ts, packages/base-ui/packages/solid/test/flushMicrotasks.ts, packages/base-ui/packages/solid/test/ssrFixtures.ts, packages/base-ui/packages/solid/test/defineSsrFixtures.ts, packages/base-ui/packages/solid/test/hydration/globalSetup.ts, packages/base-ui/packages/solid/src/utils/testUtils.ts, packages/base-ui/vitest.shared.mts]
verified: 2026-10-22
---

# Test quirks

Solid 2 batches writes until a flush, so the harness flushes after every testing-library event and gives React's `act` helpers flush-based twins; most other quirks come from jsdom limits, browser differences and server rendering.

## Imports

- `#test-utils` resolves to `packages/solid/test/index.ts` (`imports` in `packages/solid/package.json`). It re-exports `createRenderer`, `act`, `flushMicrotasks`, `isJSDOM`, pointer helpers, `wait`, `waitSingleFrame`, `waitForPositioned`, and the shared conformance suites (`describeConformance`, `popupConformanceTests`, `positionerConformanceTests`, and others).
- `isJSDOM` lives in `packages/solid/src/utils/testUtils.ts` (the public `utils` entry re-exports it, so it must load on the server too).

## Flushing

| need | use | what it does |
| --- | --- | --- |
| event through `fireEvent` / `user` | nothing | `setupSolid.ts` sets testing-library's `eventWrapper` to `flush()` after each event, and `asyncWrapper` to flush then yield a macrotask |
| direct DOM call (`element.click()`, `focus()`) or a signal write | `act(() => ...)` or `flush()` | `test/act.ts`: runs the callback, then `flush()`; async callbacks flush after they settle |
| pending promise reactions | `await flushMicrotasks()` | 10 rounds of `await Promise.resolve(); flush()` |
| initial microtasks after mount (initial focus) | `await render(...)` | the render result is thenable: `flush()`, one macrotask (a `MessageChannel` under fake timers, which are not advanced), `flush()` |

- No flush runs during teardown: flushing inside root disposal re-runs half-disposed computations.
- A flush inside an effect is a no-op and Solid warns `FLUSH_IN_EFFECT_CALLBACK`. `setupSolid.ts` drops that warning only while the harness's own flush runs; library code that triggers it elsewhere still fails the console check.
- A render that throws removes the partial tree, portals included, because Solid leaves it in the document where React would unmount it. The browser's duplicate `window` error report is suppressed.

## Cleanup and isolation

- Auto-cleanup is off (`test/disableAutoCleanup.ts` sets `STL_SKIP_AUTO_CLEANUP`); `setupSolid.ts` runs `cleanup()` before each test and, guarded, after each test.
- The Solid error log resets after each test (`src/utils/error`).
- The shared setup (`packages/base-ui/test/setupVitest.ts`, MUI's `setupVitest`) fails a test on unexpected console warnings or errors, resets mocks, and sets `globalThis.BASE_UI_ANIMATIONS_DISABLED = true` after every test. A test of animated behavior sets it to `false` itself.
- Browsers: the Playwright pointer is parked before each file (a hover-opened popup would otherwise open under a leftover cursor), and each test ends with a `MessageChannel` yield so a pending `ResizeObserver` delivery finishes before the next test.

## jsdom limits

- No layout: sizes, positions, scrolling, `getAnimations`, real focus-visible and pointer capture need a browser. Mark those `it.skipIf(isJSDOM)` / `describe.skipIf(isJSDOM)` with a one-line reason (see `packages/base-ui/AGENTS.md`). Current counts in `packages/solid/src` and `test`: 520 `skipIf(isJSDOM)`, 91 `skipIf(!isJSDOM)`, 677 `skipIf(` in all.
- The shared jsdom setup maps `requestAnimationFrame` to a `setTimeout` that cannot be cancelled; `setupSolid.ts` replaces it with one whose `cancelAnimationFrame` works, as in browsers.
- `test-parity.mjs` evaluates every `skipIf`/`runIf` against upstream's condition. A Solid skip in an environment upstream runs the test fails CI; see [parity](parity.md).

## Browser differences

- Desktop Firefox lacks `Touch`/`TouchEvent`, and WebKit throws from `new Touch(...)`. `setupSolid.ts` installs constructors that carry the touch lists; library code never feature-detects them.
- Engine-specific skips use `isWebKit`, `platform.engine.*` or `/WebKit/.test(navigator.userAgent)`; the parity script models each.
- Environment probes in a test file (`CSS.supports`, engine flags, `navigator` reads) are evaluated inside the test or the skip condition, never at module load: a module-level throw takes out every test in the file, and some reporters show it as "0 tests". jsdom defines `CSS` without `CSS.supports`; a load-time `CSS.supports(...)` in the drawer keyboard tests failed main's JSDOM suite (28c62fe5 fixed it). Safari implements no `overflow-anchor`, and Solid's style binding drops a property the engine lacks, so its tests assert the scroll anchor only where `CSS.supports('overflow-anchor', 'auto')` holds.
- CI retries a failed test once (`vitest.shared.mts`). Browser parity confirms Solid-only failures with two reruns.
- WebKit ignores a zero-movement `mousemove` in list navigation (`isStationaryWebKitPointer` in `useListNavigation.ts`, upstream mui/base-ui#4002), and `fireEvent.mouseMove` sends zero movement by default. A test that moves the highlight by mousemove passes `{ movementX: 1, movementY: 1 }`, or it fails in WebKit only (the Menu fan-out test, 59364cf9).
- Local WebKit on this Linux host: Playwright's WebKit lacks system libraries here (`browserType.launch: Host system is missing dependencies`), so run it in Playwright's image (`mcr.microsoft.com/playwright:v<playwright-core>-noble`) over a read-only overlay of the worktree: `bash scripts/webkit-docker.sh <script> <report.json> [filters...]` from `packages/base-ui`, which `test:base-ui:all --changed` uses for the scoped `parity-webkit` and `browser-parity.mjs` for its confirm reruns (`PARITY_RUNNER`). A machine's first run pulls the image (about 2 GB) inside the suite's timeout; later runs reuse it. The script removes its container, overlay volume and layers on every exit, an interrupted run included. The tree must have its own install, as the stamp worktree does: a worktree that resolves packages from the checkout's install links its workspace packages to the checkout, outside the container.

## Time zone

- `test:solid:_unit` sets `TZ=UTC`; browser mode pins the context with `timezoneId: 'UTC'`, since a browser cannot follow `process.env.TZ`.
- Temporal adapter suites skip cases with `skipIf(!adapter.isTimezoneCompatible)` (22 sites).

## Server rendering and hydration

- Fixtures: a `*.ssr-fixtures.tsx` default export of `defineSsrFixtures(import.meta.url, { name: () => <Part /> })` (38 files under `src`).
- `test/hydration/globalSetup.ts` renders every fixture in Node with Solid's SSR transform before the run (browser mode has no SSR loader) and provides the HTML, URI-encoded, through `inject('ssrFixtures')`. It also renders `test/hydration/*.server.tsx` entries.
- `renderServer(fixtures, 'name', { render })` inserts the HTML; `render` is `'string'` (default), `'stream'` or `'streamBoundaries'`. `hydrate()` sets up `window._$HY`, hydrates the client build inside a sentinel, flushes, and returns `{ dispose, user }`. `unclaimedNodes()` lists server nodes hydration left unclaimed.
- Each upstream `renderToString(` needs a Solid `renderServer(` in the counterpart file, or `test-parity.mjs` fails.
- Pure server tests (`test/ssr/*.test.ts`) run in the `@solidports/base-ui:ssr` Node project.

## Diagnostics inventory

`SOLID_DIAG_FILE=<path>` makes `setupSolid.ts` append every Solid dev diagnostic with its first library stack frames instead of printing it; `SOLID_DIAG_FULL=1` keeps whole stacks; `SOLID_ATTRIBUTION=1` also enables Solid's attribution engine (relayed or self-written state, over-wide subscriptions).

Related: [suites](suites.md), [SSR and hydration](../architecture/ssr-hydration.md), [reactivity](../solid/reactivity.md).
