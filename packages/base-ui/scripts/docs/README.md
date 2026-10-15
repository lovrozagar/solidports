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
3. `docs:generate` (`generate.mjs`) — write `docs/solid` from `docs/react`: React code goes through `react-to-solid.mjs`, MDX pages transform their ESM, JSX and code samples, and everything else is copied. `templates/` supplies what Next.js and React give the React docs (the App Router, the docs-infra loaders, `next/*`, React runtime APIs). Files are rewritten only when their content changes and stale files are pruned, so it is safe to run next to `docs:dev`.
4. `docs:validate` — docs-infra writes the API tables (`types.md`) and page indexes, as upstream's `docs:validate` does. Commit what it writes; CI fails when it changes the tree.
5. `docs:build`, then `docs:check-hydration --serve` — crawls every route of the build: route parity with the React docs, hydration (every server-rendered element claimed), and each page's first demo opening without being rebuilt.

Fix a demo the transform cannot port in `react-to-solid.mjs` or `templates/`. To leave a page, a section or its demos out (no Solid 2 version of the library it shows), add it to `excluded.mjs` with the reason.

## docs-infra runtime

docs-infra splits in two. Its build-time half (`pipeline/`: the loaders that precompute highlighted
code, type data and the sitemap, and their helpers) is generated from `docs/docs-infra`. Its runtime
half, the hooks and components the pages render with, is kept by hand in
`templates/docs-infra/src`, for Solid's model: an element is built where it is placed, hydration
keys follow the owner tree, and nothing re-renders a whole component. A module there replaces the
docs-infra module at the same path; the generator converts what it imports instead.

| Entry | Hand-written for Solid |
| :--- | :--- |
| `abstractCreateTypes`, `useTypes`, `useType` | Type data maps as upstream; each HAST field is an `element()` rendered where the table places it (`pipeline/hastToSolid`). `TypeCode` shows the links-only fallback on the server and in the first client render. |
| `abstractCreateDemo`, `CodeHighlighter`, `useCode`, `useDemo` | Precomputed code only: no client loading, parsing, transforms, enhancers or live editing (upstream enables editing only under a `CodeControllerContext`, which the docs do not use). Hooks return one object of getters. |
| `useSearch`, `usePreference`, `createSitemap`, `useUrlHashState`, `useCopier` | Upstream's behavior; values that depend on the browser are `null` through hydration, as React's server snapshots. |

Tests sit beside each module (`*.test.tsx`, with `*.server.tsx` entries `__fixtures__/globalSetup.ts`
server-renders before the run) and run in `@solidports/docs:dom`.

On a docs-infra bump, diff `docs/docs-infra/src` for the entries above and port the changes by hand.
To see the data the loaders hand the runtime, transform a page module with Vite (`environments.client.transformRequest`) and read the precomputed `meta` argument.
