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
3. `docs:generate` — regenerate MDX, demos, CSS, fonts, sitemap from `docs/react`. Files are rewritten only when their content changes and stale files are pruned, so it is safe to run next to `docs:dev`.

When a transform cannot port a demo, put the hand-ported file in `docs/solid/overrides/demos/<path>`; it replaces the generated one. To leave a demo and its MDX section out (for example, no Solid 2 library exists yet), add it to `EXCLUDED` in `generate-solid-docs.mjs`.
