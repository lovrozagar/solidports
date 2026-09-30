# `.kb` index

Flat, grep-friendly list of every KB file. Routing logic in `./README.md`.

## Entry & meta

- `./README.md` — single entry point.
- `./INDEX.md` — this file.

## Concepts (framework-agnostic)

- `./concepts/store-design.md` — Redux→Solid store mapping, actions, selectors, event handlers. Moved from SOLID-STORE-DESIGN.md.
- `./concepts/dependency-graph.md` — file dependency graph and port layering order. Moved from DEPENDENCY-GRAPH.md.

## React (upstream, READ-ONLY mirror knowledge)

- `./react/` — stubs created on demand per component/topic.

## Solid (the port)

- `./solid/reactivity-rules.md` — recharts-specific rules: no destructuring store, createMemo for derived math, batch() in event handlers.
- `./solid/gotchas.md` — append-only registry (GOTCHA-NNN).
- `./solid/store-semantics.md` — pointer to concepts/store-design.md with usage notes.
- `./solid/testing-quirks.md` — React→Solid test-helper deltas (QUIRK-NNN). See `test/helper/renderWithSignals.tsx`.

## Porting

- `./porting/playbook.md` — step ordering for porting any recharts component.
- `./porting/upstream-sync.md` — stub, filled in Phase 2.

## Workflows

- `./workflows/porting-a-new-component.md` — task checklist.
- `./workflows/fixing-a-failing-test.md` — diagnosis checklist.

## Components

Created on demand. Use `./components/_template.md` as base (create when needed).
