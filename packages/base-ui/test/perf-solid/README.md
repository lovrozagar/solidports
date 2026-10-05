# Solid vs React Base UI benchmark

Identical scenarios rendered by `@base-ui/react` (`react/`) and `@solidports/base-ui` (`solid/`),
built in production mode and driven in Chromium. The step gate for perf work (plan 7).

```bash
# from packages/base-ui
bun run bench:solid:build          # production builds of both apps
bun run bench:solid -- 10          # all scenarios, 10 measured runs each
bun run bench:solid -- 8 select,menu
```

- Builds go to `<repo>/.tmp/grunt/bench-builds/<lib>/<OUT>`, results to `<repo>/.tmp/grunt/bench-results/`.
- `VARIANTS=name:lib:dir,...` serves several builds and interleaves them (A/B). Only interleaved
  ratios from one session are comparable; this machine's absolute numbers drift up to 2x.
- `SOLID_SRC=<abs path inside the repo>` builds the Solid app from a copy of the library source
  (prototypes), e.g. `OUT=dist-proto SOLID_SRC=... LIB=solid npx vite build -c test/perf-solid/vite.config.mjs` (from `packages/base-ui`).
- `MINIFY=0` for readable builds; `node profile.mjs <lib> <scenario> <dir> [setup] [measured]`
  prints CPU self time and sampled live heap per function.
