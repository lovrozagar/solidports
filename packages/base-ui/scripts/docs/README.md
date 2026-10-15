# Docs pipeline (from zero)

React docs are a 1:1 copy of `mui/base-ui` `docs/` at `DOCS_TAG` (default `v1.9.0`).
Solid docs are generated from that copy, file for file. Do not hand-edit `docs/solid`.

```bash
bun run docs:bootstrap     # clone + install + generate
bun run docs:react:dev     # http://localhost:3005  (OSS React docs)
bun run docs:dev           # http://localhost:3001  (generated Solid docs)
```

Steps:

1. `docs:sync` — clone `mui/base-ui@TAG`, copy `docs/` → `docs/react`, overlay only workspace paths (`workspaceRoot`, tsconfig `../../packages`, package name `docs`).
2. `bun install`
3. `docs:generate` (`generate.mjs`) — write `docs/solid` from `docs/react`: React code goes through `react-to-solid.mjs`, MDX pages transform their ESM, JSX and code samples, and everything else is copied. `templates/` supplies what Next.js and React give the React docs (the app router, the docs-infra loaders, `next/*`, React runtime APIs). Files are rewritten only when their content changes and stale files are pruned, so it is safe to run next to `docs:dev`.
4. `docs:validate` — docs-infra writes the API tables (`types.md`) and page indexes, as upstream's `docs:validate` does. Commit what it writes; CI fails when it changes the tree.

Fix a demo the transform cannot port in `react-to-solid.mjs` or `templates/`. To leave a section and its demos out (no Solid 2 version of the library it shows), add it to `EXCLUDED_SECTIONS` in `generate.mjs` with the reason.
