<!-- markdownlint-disable MD038 -->

# Base UI fork (SolidPorts)

This tree is the Base UI fork inside the SolidPorts monorepo (`packages/base-ui`).
Repo-wide rules live in the monorepo root `AGENTS.md`. This file is the fork map.

## Layout

```
packages/react/     @base-ui/react snapshot — read, replace on version bump
packages/utils/     @base-ui/utils snapshot — same
packages/solid/     @solidports/base-ui — only living library
docs/react/         mui/base-ui `docs/` at the same tag — snapshot
docs/solid/         Solid docs app, generated from docs/react by scripts/docs
context/            agent context for the port (start at context/INDEX.md)
```

Snapshot in, Solid out. Do not rewrite `packages/react`, `packages/utils`, or
`docs/react` to match Solid.

## Scope

Unless the request says otherwise, implement only in `packages/solid/` or
`scripts/docs/`.

`docs/solid` is generated output: pages under `docs/solid/src/app/(docs)/solid/`
come from `docs/react/src/app/(docs)/react/`. Fix the docs in the generator
(`scripts/docs/react-to-solid.mjs`, `scripts/docs/templates/`), then run
`bun run docs:generate` and `bun run docs:validate`. docs-infra's runtime (the
hooks and components pages render with) is the exception: it is kept by hand in
`scripts/docs/templates/docs-infra/src` (see `scripts/docs/README.md`).

React docs reference: `docs/react/src/app/(docs)/react/`. Experiments in the
snapshot live at `docs/react/src/app/(private)/experiments/`.

## Commands

From the monorepo root:

```bash
bun run docs:sync             # clone mui/base-ui@v1.9.0 docs → docs/react
bun run docs:generate         # generate docs/solid pages + demos from docs/react
bun run docs:dev              # Solid docs (Vite start mode, port 3001)
bun run docs:react:dev        # React docs snapshot (Next, port 3005)
```

From `packages/base-ui`:

```bash
bun run docs:dev
bun run docs:build
bun run docs:check-hydration --serve   # crawl the build: parity, hydration, demos
bun run docs:api              # docs-infra API tables (types.md)
bun run docs:react:dev
bun run test:solid:jsdom NumberField --no-watch
bun run test:solid:chromium NumberField --no-watch
```

From the monorepo root: `bun run fmt`, `bun run lint`, `bun run typecheck`,
`bun run test:base-ui`.

## Context

`context/INDEX.md` maps the agent context for this fork: architecture, Solid notes, testing,
perf, tooling, workflows, components and decisions, one topic per file. Read the map once; when a
row matches the work, read that file in full before changing code.

- Each file has frontmatter: `tags`, `sources` (the repo paths it describes, which must exist)
  and `verified` (the date it was last checked against the code). Update `verified` when you
  re-check a file, and fix the file when the code it describes changes.
- After adding or editing a file, run `bun scripts/context-map.ts` from the monorepo root to
  rewrite `INDEX.md`. `bun run test:scripts` fails on a stale map, a missing source path or a
  broken link.
- Record decisions in `context/decisions/log.md` as new dated entries; never edit old ones.

## Solid

Follow the monorepo root `AGENTS.md` reactivity rules (no prop destructure,
`createMemo` for derived values, `createEffect(compute, apply)` or
`createTrackedEffect` + `onCleanup`, `onSettled`).

## Tests

Colocate as `Name.test.tsx` next to `Name.tsx`. Prefer vitest `expect()` /
`vi.fn()`. Browser-only cases: `it.skipIf(isJSDOM)` / `describe.skipIf(isJSDOM)`.
New skips need a one-line Solid-runtime reason.

## Errors

Public error messages: prefix `Base UI: `, say what happened, why it matters,
and how to fix it. After changing `Error` constructors, run
`bun run extract-error-codes` (writes `docs/react/src/error-codes.json`).
Update an existing code when the argument count and meaning stay the same.
