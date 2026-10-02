## Writing style

en-US English everywhere — code, comments, docs, commit messages.

## Git

Stay on `main`. Don't create, switch, or delete branches.

Fine without asking: `status`, `diff`, `log`, `add`, `commit`, `push`.

Ask first, and wait: anything that can lose work — `reset --hard`, `checkout` /
`restore` over uncommitted changes, `clean`, `stash` (any form), `push --force`
(including `--force-with-lease`), `rebase`, `cherry-pick`, `revert`,
`commit --amend`, deleting tags, anything reflog-driven. If you can't tell,
assume it can.

## Scope

Unless the request says otherwise, a feature or fix applies only to:

- `packages/base-ui/packages/solid` for Base UI
- `packages/recharts` for Recharts
- `packages/flare-ui` for Flare UI
- `packages/flare-ui-consumer` for the Flare UI gallery

`packages/base-ui/packages/react` is the upstream reference. Do not "fix" it to
match Solid. Docs live in `packages/base-ui/docs/solid`. `packages/base-ui/docs/react` is the upstream docs snapshot.

## Solid reactivity

- Never destructure props at the call site. `props.foo`, not `const { foo } = props`.
- Derived values from props or store → `createMemo`. Never compute inline in JSX.
- Side effects → `createEffect(compute, apply)` or `createTrackedEffect` for a single callback. Cleanup → `onCleanup` inside the same effect.
- Mount logic → `onSettled`. Never import React `useEffect`.
- Writes batch on a microtask. Call `flush()` when the next read must see them now.
- JSX import source is `@solidjs/web`.

## Before you call it done

From the repo root; CI runs the same set, with `fmt:check` in place of `fmt`.

    bun run fmt          # oxfmt, rewrites in place
    bun run lint         # oxlint (repo shell; packages keep their own linters)
    bun run typecheck
    bun run test         # @solidports/recharts unit

Touched Base UI Solid? Also `bun run test:base-ui`.

Package-local oxlint/prettier/eslint configs stay. Do not reformat a restored
upstream tree to make root oxfmt happy.
