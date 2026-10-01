# @solidports/flare-ui — Agent Guidelines

## Scope

Any feature/fix request applies only to this package (`packages/flare-ui/`) unless explicitly stated otherwise. Do not edit `packages/base-ui` or `packages/recharts`.

## Solid reactivity rules

- Never destructure props at the call site. `props.foo`, not `const { foo } = props`.
- Derived values computed from props or store → `createMemo`. Never compute inline in JSX.
- Side effects → `createEffect`. Cleanup → `onCleanup` inside the same effect.
- Mount logic → `onMount`. Never use `useEffect` (React import).
- Multiple setters in an event handler → wrap in `batch(() => { ... })`.
- `splitProps` for rest-spread on visual primitives.

## Commands

```bash
# typecheck
bun run --filter @solidports/flare-ui type:check

# fixture typecheck
cd packages/flare-ui && bun run --filter @solidports/flare-ui-fixture exec tsc --noEmit -p tests/fixture/tsconfig.json

# e2e (chromium-ltr)
cd packages/flare-ui && bun run test

# e2e (all Playwright projects)
cd packages/flare-ui && bun run test:all

# format this tree only
bunx oxfmt packages/flare-ui
```

## Errors

Prefix all thrown error messages with `@solidports/flare-ui: `.

## Lint / typecheck policy

- No `as any` casts.
- Keep `strict`. Do not weaken tsconfig to make typecheck pass.
- Root oxlint ignores this package. Do not reformat `packages/base-ui` or `packages/recharts` to make root oxfmt happy.

## Public API

- Subpath exports only. No root barrel.
- Depend on workspace `@solidports/base-ui`. Do not add `@lovrozagar/flare` or sx.
- `mergeClass` for port-backed `class` callbacks.
- `field.tsx` is visual-only.
- P1 inventory only (no Calendar/DatePicker/Command/Sidebar/Table/P3 TanStack bindings).

## Testing

- Gallery (all 42 on one page): `packages/flare-ui-consumer`, HTTP port 4100. `bun run --filter @solidports/flare-ui-consumer dev`.
- Fixture speaks HTTP on port 4099.
- Default `test` script is `playwright test --project=chromium-ltr`.
- Selectors: `getByRole()`, `getByText()`, Base UI `data-*`. Never `[data-slot=...]`.
