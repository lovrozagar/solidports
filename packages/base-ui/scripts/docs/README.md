# Docs pipeline (from zero)

React docs are a 1:1 copy of `mui/base-ui` `docs/` at `DOCS_TAG` (default `v1.8.0`).
Solid docs are generated from that copy. Do not hand-edit generated Solid pages or demos.

```bash
bun run docs:bootstrap     # clone + install + generate
bun run docs:react:dev     # http://localhost:3005  (OSS React docs)
bun run docs:dev           # http://localhost:3001  (generated Solid docs)
```

Steps:

1. `docs:sync` — clone `mui/base-ui@TAG`, copy `docs/` → `docs/react`, overlay only workspace paths (`workspaceRoot`, tsconfig `../../packages`, package name `docs`).
2. `bun install`
3. `docs:generate` — wipe Solid routes/demos and regenerate MDX, demos, CSS, fonts, sitemap from `docs/react`.
