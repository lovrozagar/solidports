<!-- markdownlint-disable MD038 -->

# Base UI fork (SolidPorts)

This tree is the Base UI fork inside the SolidPorts monorepo (`packages/base-ui`).
Repo-wide rules live in the monorepo root `AGENTS.md`. This file is the fork map.

## Layout

```
packages/react/     @base-ui/react snapshot — read, replace on version bump
packages/utils/     @base-ui/utils snapshot — same
packages/solid/     @solidports/base-ui — only living library
docs/react/         mui/base-ui `docs/` at the same tag — snapshot
docs/solid/         Solid docs app (`@solidjs/vite-plugin` start mode) — only living docs
.kb/                maintainer/agent notes for the Solid port
```

Snapshot in, Solid out. Do not rewrite `packages/react`, `packages/utils`, or
`docs/react` to match Solid.

## Scope

Unless the request says otherwise, implement only in `packages/solid/` or
`docs/solid/`.

Public docs and demos: `docs/solid/src/routes/(docs)/solid/` and
`docs/solid/src/demos/solid/<component>/<demo>/{css-modules,tailwind}/`.
Use the component's `hero` demo as the styling reference. Add only the layout
styles the demo needs.

React docs reference: `docs/react/src/app/(docs)/react/`. Experiments in the
snapshot live at `docs/react/src/app/(private)/experiments/`.

## Commands

From the monorepo root:

```bash
bun run docs:sync             # clone mui/base-ui@v1.8.0 docs → docs/react
bun run docs:generate         # generate docs/solid pages + demos from docs/react
bun run docs:dev              # Solid docs (Vite start mode, port 3001)
bun run docs:react:dev        # React docs snapshot (Next, port 3005)
```

From `packages/base-ui`:

```bash
bun run docs:dev
bun run docs:build
bun run docs:api              # Solid API reference JSON
bun run docs:react:dev
bun run test:solid:jsdom NumberField --no-watch
bun run test:solid:chromium NumberField --no-watch
```

From the monorepo root: `bun run fmt`, `bun run lint`, `bun run typecheck`,
`bun run test:base-ui`.

## Solid

Follow the monorepo root `AGENTS.md` reactivity rules (no prop destructure,
`createMemo` for derived values, `createEffect(compute, apply)` or
`createTrackedEffect` + `onCleanup`, `onSettled`). Porting notes: `.kb/README.md`.

## Tests

Colocate as `Name.test.tsx` next to `Name.tsx`. Prefer vitest `expect()` /
`vi.fn()`. Browser-only cases: `it.skipIf(isJSDOM)` / `describe.skipIf(isJSDOM)`.
New skips need a one-line Solid-runtime reason.

## Errors

Public error messages: prefix `Base UI: `, say what happened, why it matters,
and how to fix it. After changing `Error` constructors, run
`bun run extract-error-codes` (writes `docs/react/src/error-codes.json`).
Update an existing code when the argument count and meaning stay the same.
