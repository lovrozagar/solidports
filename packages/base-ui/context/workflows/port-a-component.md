---
tags: [porting, workflow, tdd, components]
sources: [packages/base-ui/packages/react/src, packages/base-ui/packages/solid/src, packages/base-ui/packages/solid/test, packages/base-ui/packages/solid/package.json, packages/base-ui/packages/solid/src/index.ts, packages/base-ui/scripts/test-parity.mjs]
verified: 2026-10-16
---

# Port a component

Port a Base UI part from `packages/react/src/<name>/` to `packages/solid/src/<name>/` test-first: upstream's tests come over before the code, run red, then the code is ported until they pass and test parity is clean.

## Inputs

- Component and scope: the whole component, one part, or an upstream change to an existing one.
- Whether the docs need anything beyond regeneration (they are generated; see [docs pipeline](../tooling/docs-pipeline.md)).

## Before you start

- Read every file under `packages/react/src/<name>/` and the shared modules it imports (`packages/react/src/internals/`, `packages/react/src/floating-ui-react/`, `packages/utils/src/`).
- Read the Solid counterparts that already exist: `packages/solid/src/internals/`, `src/floating-ui-solid/`, `src/utils/`, `src/solid-helpers.tsx`.
- Read the context the part touches: [idiom map](../react/idiom-map.md) for React → Solid translations, [reactivity](../solid/reactivity.md), [refs and events](../solid/refs-and-events.md), [render pipeline](../architecture/render-pipeline.md), [store and state](../architecture/store-and-state.md), and, as needed, [floating](../architecture/floating.md), [composite lists](../architecture/composite-lists.md), [transitions](../architecture/transitions.md), [SSR and hydration](../architecture/ssr-hydration.md). Check [gotchas](../solid/gotchas.md) and an existing note under `components/` for a sibling part.
- The Solid reactivity rules are in the root `AGENTS.md`; the TDD and gate rules in `.claude/rules/standards.md`.

## Layout to mirror

Each part sits at the same relative path as upstream, for example `src/accordion/root/AccordionRoot.tsx` with:

- `AccordionRoot.test.tsx`: the ported upstream tests (same titles; test parity matches them);
- `AccordionRoot.spec.tsx`: type tests, checked by `tsc -p tsconfig.test.json --noEmit`;
- `AccordionRoot.ssr-fixtures.tsx`: server-render fixtures where upstream has server tests;
- `*DataAttributes.ts`, `*CssVars.ts`, `*Context.ts`, as upstream.

`src/<name>/index.ts` re-exports `index.parts.ts` as the namespace (`export * as Accordion from './index.parts'`) plus types and attribute enums.

## Loop (red, fix, green)

1. Red: port the upstream test file(s) first.
   - Import `createRenderer`, `describeConformance` and helpers from `#test-utils` (ESLint enforces it). Its `render` takes a function: `render(() => <Part />)`.
   - Keep upstream titles verbatim. Upstream's `act()` and `flushMicrotasks` exist in `#test-utils`; Solid's `act` runs the callback and calls `flush()`, so keep them where upstream has them.
   - Browser-only cases use `it.skipIf(isJSDOM)` with a one-line reason; a skip where upstream runs the test fails test parity.
   - Run it and record the failure: `bun run test:solid:jsdom <Name> --run --reporter=agent` from `packages/base-ui`.
2. Fix: port the source. Use the Solid primitives the idiom map names, the existing `internals/` hooks, and `useRenderElement` for rendered parts. Never destructure props.
3. Green: rerun jsdom, then `bun run test:solid:chromium <Name> --run --reporter=agent`.
4. Prove the test can fail: break the fix once and see it go red (`.rulesync/reference/tdd.md`).

## Wire a new component

- Add `export * from './<name>'` to `src/index.ts`.
- Add the `./<name>` entry to `exports` in `packages/solid/package.json` (`types` → `./types/<name>/index.d.ts`, `solid` and `default` → `./src/<name>/index.ts`). `src/index.test.tsx` and `test/package/exports.test.ts` check the exports.
- New `Error` messages: start with the `Base UI:` prefix and run `bun run extract-error-codes` (see `packages/base-ui/AGENTS.md`).

## Checks before done

From `packages/base-ui`:

- `node scripts/test-parity.mjs`: no missing file or title for the part, no new skip.
- `bun run test:solid:jsdom <Name> --run` and `bun run test:solid:chromium <Name> --run` pass.
- In `packages/solid`: `bun run typescript` and `bunx tsc -p tsconfig.test.json --noEmit`.
- `bunx eslint packages/solid/src/<name> --max-warnings 0`.
- `bun run docs:generate` and `bun run docs:validate` leave the docs building; a demo problem goes through the docs pipeline's "Fix a demo".

From the root: `bun run verify` (needs a committed tree) and `bun run test:base-ui:all`; report passed, failed and not run.

Then add or update the component note under `components/` and any new cross-cutting pitfall in [gotchas](../solid/gotchas.md). A failing test on the way: [fix a failing test](fix-a-failing-test.md).
