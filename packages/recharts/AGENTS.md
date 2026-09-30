# @solidports/recharts — Agent Guidelines

## Scope

Any feature/fix request applies only to this package (`packages/recharts/`) unless explicitly stated otherwise. Do not touch other packages in the monorepo.

## Solid reactivity rules

- Never destructure props at the call site. `props.foo`, not `const { foo } = props`.
- Derived values computed from props or store → `createMemo`. Never compute inline in JSX.
- Side effects → `createEffect`. Cleanup → `onCleanup` inside the same effect.
- Mount logic → `onMount`. Never use `useEffect` (React import).
- Multiple setters in an event handler → wrap in `batch(() => { ... })`.
- Store reads are fine-grained by default — no need for `useSelector` shims.
- `createStore` / `produce` / `reconcile` from `solid-js/store` replace Redux toolkit entirely.

## Commands

```bash
# build
cd packages/recharts && bun run build

# test (full suite)
cd packages/recharts && bunx vitest run

# test (pattern)
cd packages/recharts && bunx vitest run <pattern>

# test (watch)
cd packages/recharts && bunx vitest <pattern>

# typecheck (always scoped — never bare tsc on repo)
bunx tsc --noEmit 2>&1 | grep "packages/recharts"

# lint (file-scoped)
bunx oxlint <file>

# lint (whole package)
cd packages/recharts && bunx oxlint src test
```

## Errors

Prefix all thrown error messages with `@solidports/recharts: `.

## Lint / typecheck policy

- Run `bunx oxlint <file>` after every file change. Fix all errors before moving on.
- Run `bunx tsc --noEmit` scoped to changed files. Never run bare on the monorepo.
- No `as any` casts unless genuinely unavoidable — document why with a `/* */` comment.

## Testing

- Test files live in `test/` mirroring `src/` structure (1:1 with upstream recharts).
- Run a pattern: `bunx vitest run CartesianAxis` — matches by filename.
- Tests are jsdom-based. No browser env unless explicitly noted.
- Do not add `act()` or `flushMicrotasks` — Solid is synchronous.

## KB

All cross-cutting knowledge (store semantics, reactivity rules, porting patterns, gotchas) lives in `.kb/`. Read `.kb/README.md` before starting any porting work.
