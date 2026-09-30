# Upstream sync — @solidports/recharts

Strategy: Option C — shallow fetch + upstream-map. No vendored copy. Pin + applied-log committed. `scripts/sync-upstream.ts` orchestrates everything.

Upstream: `recharts/recharts`, pinned at `v3.8.1` (`5b10788d082424d026480d63d18ca5c8a5a5628f`).

## Files

    .upstream/pinned.json      current pin (tag, sha, date)
    .upstream/applied.jsonl    append-only log of ported commits
    .upstream/map.json         React→Solid file mapping
    .upstream/cache/           gitignored — shallow clones (auto-managed)
    .upstream/patches/         gitignored — per-SHA patch files
    scripts/sync-upstream.ts   CLI tool

## Workflow

Standard cadence: check weekly or before any porting session.

### 1. Fetch upstream

```bash
cd /home/ecomet/Development/monorepo/public/solid-ports/recharts
bun run upstream:fetch
```

Clones `recharts/recharts` at the pinned tag into `.upstream/cache/recharts-v3.8.1/`. Reuses the clone if less than 1 hour old. Re-clones if stale or missing.

### 2. Check status

```bash
bun run upstream:status
```

Hits the GitHub API to compare pinned SHA against upstream `main`. Prints:

- Pinned SHA + tag + date
- Upstream main HEAD SHA
- N commits behind
- Commits grouped by: `[actionable] code`, `[actionable] tests`, `[info] docs-only`, `[info] deps-only`, `[info] ci-only`, `[info] other`

Exit code 0 if up-to-date, 1 if actionable commits exist.

Set `GITHUB_TOKEN` in env to raise the GitHub API rate limit from 60 to 5000 req/hr:

```bash
GITHUB_TOKEN=ghp_xxx bun run upstream:status
```

### 3. Review diff

```bash
bun run upstream:diff
# or between specific SHAs:
bun run upstream:diff abc1234 def5678
```

Runs `git diff <from>..<to> -- src/ test/` on the cached clone. Saves full patch to `.upstream/last-diff.patch`. Prints per-file stat summary.

If no from-sha given, defaults to pinned SHA. If no to-sha, defaults to clone HEAD.

### 4. Inspect a single commit

```bash
bun run upstream:apply <full-40-char-sha>
```

Extracts the commit patch, writes it to `.upstream/patches/<sha>.patch`, and prints:

- Each changed upstream file → its Solid counterpart path (via `map.json`)
- Mode: `one-to-one | rename | split | heavy-rewrite | excluded`
- Warning if any file is `heavy-rewrite` (patch won't apply cleanly)

This command is display-only. It never modifies source files.

### 5. Translate to Solid

Open the patch and the Solid counterpart side-by-side. For `one-to-one` files: apply the diff mechanically, replacing React APIs with Solid equivalents per `.kb/solid/reactivity-rules.md`.

For `heavy-rewrite` files: read the intent of the upstream change, then replicate that intent in the Solid rewrite — the patch itself is reference only.

Run tests after each file:

```bash
cd /home/ecomet/Development/monorepo/public/solid-ports/recharts
bunx vitest run <pattern>
```

### 6. Pin the new baseline

After porting a batch of commits:

```bash
bun run upstream:pin v3.9.0
# or pin a bare SHA:
bun run upstream:pin abc1234def5678abc1234def5678abc1234def56
```

Updates `.upstream/pinned.json` and appends an entry to `.upstream/applied.jsonl`. Commit both files.

For individual ported commits (smaller granularity than a full pin), manually append to `applied.jsonl`:

```json
{"files":["src/cartesian/Line.tsx"],"ported_at":"2026-05-01","ported_by":"lovrozagar","sha":"abc123...","summary":"fix line animation easing"}
```

## When to pin a new baseline

Pin when one of:
- A new upstream release tag is available and you've reviewed + ported all actionable commits since the last pin.
- `applied.jsonl` accumulates > 50 individual SHA entries on the same baseline — pin the next tag and the log auto-resets context.
- A breaking upstream refactor lands that requires coordinated multi-file porting — pin immediately before starting.

Do not pin mid-batch. Pin marks "this baseline is fully ported." Partial pints corrupt the delta signal.

## Conflict resolution

### one-to-one files

The patch should apply with minor adaptation (React hooks → Solid primitives, `useEffect` → `createEffect`, etc.). Follow `.kb/solid/reactivity-rules.md`.

### heavy-rewrite files

These files diverge fundamentally from upstream:
- `src/state/store.ts` — Redux → Solid createStore
- `src/state/RechartsReduxContext.tsx` — Redux context → Solid createContext
- `src/state/hooks.ts` — useAppSelector/useAppDispatch → direct store reads
- `src/hooks.ts` — React hooks → Solid primitives
- `src/util/ReactUtils.ts` — React.Children/cloneElement → render props

For these: read the upstream commit message and diff to understand intent. Reimplement the intent in the existing Solid rewrite — never try to apply the patch directly.

### Extension mismatches

Several upstream files use `.tsx` where the port uses `.ts`. `map.json` tracks these via `mode: "rename"`. When diffing, reference the port `.ts` file when upstream shows `.tsx`.

### Unported upstream files

These upstream files have no port counterpart yet (see `map.json` `unported_upstream`):
- `src/state/renderedTicksSlice.ts`
- `src/util/createCartesianCharts.tsx`
- `src/util/createPolarCharts.tsx`
- `src/util/usePrefersReducedMotion.ts`

If an upstream commit touches one of these, `upstream:apply` will mark the Solid path as `[MISSING in port]`. Port the file first if the change is load-bearing, or skip and document in `applied.jsonl` summary.

## Divergence tracking

Port-only files (no upstream counterpart) live in `map.json` under `solid_additions`:
- `src/util/CamelCaseSVGAttrs.ts` — SVG attribute mapping for Solid JSX

These are never flagged as "unported" by the status tool.

## Cadence recommendation

- Weekly: `bun run upstream:status` — 30 seconds. Catch CI-only and deps commits early.
- Per release tag: full fetch + diff + port session. recharts ships point releases roughly monthly.
- Before Phase 3+ porting sessions: always run `upstream:status` first to confirm the map is current.

## See also

- `.upstream/map.json` — file mapping with per-file mode and notes
- `.upstream/README.md` — schema docs for `applied.jsonl`, cache layout
- `.kb/solid/reactivity-rules.md` — how to translate React patterns
- `.kb/solid/gotchas.md` — known sharp edges (className, Object.assign, etc.)
- `scripts/sync-upstream.ts` — CLI source (≤500 lines, fully typed)
