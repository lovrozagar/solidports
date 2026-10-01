# `.kb` — Base UI Solid port notes

**Read this first.** Agent-agnostic, terse. Long-form Solid rules live in the
monorepo root `AGENTS.md` and `packages/base-ui/AGENTS.md`. This tree adds
porting memory the source does not already show.

## Layout (SolidPorts)

```
packages/base-ui/
  packages/react/     snapshot
  packages/utils/     snapshot
  packages/solid/     living library
  docs/react/         docs snapshot
  docs/solid/         living docs
  .kb/                this tree
```

## What this is

- Additive notes for the Solid port (gotchas, playbook, per-component status).
- Not a replacement for [`../AGENTS.md`](../AGENTS.md) or the monorepo root
  `AGENTS.md`.
- Topics split as **concept / react / solid** with the same basename.

## How to navigate

| Question | Read |
| :------- | :--- |
| How does X work in the abstract? | `concepts/<topic>.md` |
| Why does the React snapshot look like that? | `react/<topic>.md` |
| Is this ported? Solid divergence? | `solid/<topic>.md` |
| Status of component C? | `components/<C>.md` |
| Port a new component | [`workflows/porting-a-new-component.md`](./workflows/porting-a-new-component.md) |
| A test is failing | [`workflows/fixing-a-failing-test.md`](./workflows/fixing-a-failing-test.md) |
| Add a docs demo | [`workflows/adding-a-docs-demo.md`](./workflows/adding-a-docs-demo.md) |
| Jargon | [`./glossary.md`](./glossary.md) |
| Solid rules for all code | [`./solid/reactivity-rules.md`](./solid/reactivity-rules.md) and repo root `AGENTS.md` |

Create missing `components/<C>.md` from [`components/_template.md`](./components/_template.md).

Inventory: [`./INDEX.md`](./INDEX.md).

## Docs pipeline

`docs/react` is a clone of `mui/base-ui` `docs/` at tag `v1.8.0` (override with `DOCS_TAG`).
`docs/solid` pages and demos are generated from that snapshot.

```bash
bun run docs:sync        # refresh docs/react from GitHub
bun run docs:generate    # write docs/solid MDX + demos + chrome CSS
bun run docs:dev         # Solid site, http://localhost:3001
bun run docs:react:dev   # React snapshot, http://localhost:3005
```

Do not hand-edit generated Solid MDX or `docs/solid/src/demos/solid/**`.

## Commands

From `packages/base-ui`:

```bash
bun run test:solid:jsdom Collapsible --no-watch
bun run test:solid:chromium Collapsible --no-watch
bun run docs:dev
bun run docs:api
```

From the monorepo root: `bun run test:base-ui`, `bun run fmt`, `bun run lint`,
`bun run typecheck`.

## Snapshots

[`./_snapshots/`](./_snapshots/) holds frozen copies of **this repo’s**
`AGENTS.md` files for drift checks. Cursor skills from the old msviderok
machine are archived there and are not sync sources.

## Conventions

- kebab-case filenames. Layer is in the path.
- Same basename across concept/react/solid.
- Stubs use [`solid/_template.md`](./solid/_template.md).
- Components are create-on-demand.
