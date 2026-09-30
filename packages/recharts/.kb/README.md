# `.kb` — @solidports/recharts knowledge base

Single entry point. Read this file first.

This KB is for the SolidJS port of recharts. It is agent-agnostic and intentionally terse. Cross-cutting decisions and architectural rationale live here; source files are the implementation ground truth.

## What this is

An additive layer on top of `AGENTS.md` and `CLAUDE.md`. It does not duplicate them — it extends with recharts-specific knowledge: store semantics, porting patterns, sync workflow, known gotchas.

Organized in three layers per topic: concept / react / solid.

## Upstream sources (read-only knowledge)

- `../AGENTS.md` — agent rules for this package.
- `../CLAUDE.md` — pointer to AGENTS.md and this README.
- `./concepts/store-design.md` — store architecture (was `SOLID-STORE-DESIGN.md`).
- `./concepts/dependency-graph.md` — dependency graph (was `DEPENDENCY-GRAPH.md`).

## 3-layer model

Every topic has up to three sibling files with the same basename:

    concepts/<topic>.md   framework-agnostic — the what and why
    react/<topic>.md      how upstream recharts does it (READ-ONLY mirror knowledge)
    solid/<topic>.md      how this port does or should do it

`grep -r '<topic>' .kb/` returns the triangle.

## Navigation

    Question                                   Read first
    "How does the store work?"                 concepts/store-design.md
    "How is the dependency graph structured?"  concepts/dependency-graph.md
    "How do I port a new component?"           workflows/porting-a-new-component.md
    "A test is failing — where do I start?"   workflows/fixing-a-failing-test.md
    "What are the Solid reactivity rules?"     solid/reactivity-rules.md
    "Known sharp edges?"                       solid/gotchas.md
    "Store semantics?"                         solid/store-semantics.md
    "How does upstream sync work?"             porting/upstream-sync.md

Flat inventory: `./INDEX.md`.

## Commands (mirrored from AGENTS.md)

```bash
cd public/solid-ports/recharts && bun run build
cd public/solid-ports/recharts && bunx vitest run <pattern>
bunx oxlint <file>
bunx tsc --noEmit 2>&1 | grep "public/solid-ports/recharts"
```
