# .upstream — sync metadata for @solidports/recharts

Tracks the upstream recharts port baseline. Committed files here are metadata only — no upstream source is vendored.

## What lives here

    pinned.json      current upstream pin (repo, tag, SHA, date)
    applied.jsonl    append-only log of ported upstream commits
    map.json         React→Solid file mapping with override annotations
    cache/           gitignored — shallow clones fetched by sync-upstream.ts
    patches/         gitignored — per-SHA patch files created by `apply` subcommand
    README.md        this file

## DO NOT commit upstream source here

`cache/` is gitignored. Never add upstream `.ts`/`.tsx` files to this directory.
If you need to inspect upstream source, run `bun run upstream:fetch`.

## Quick reference

```bash
# Fetch or reuse cached upstream clone
cd /home/ecomet/Development/monorepo/public/solid-ports/recharts
bun run upstream:fetch

# Check how far behind the pin we are
bun run upstream:status

# Inspect commits since the pin
bun run upstream:diff

# Generate a patch for a single upstream commit
bun run upstream:apply <sha>

# Advance the pin after porting a batch of commits
bun run upstream:pin <tag-or-sha>
```

Full playbook: `.kb/porting/upstream-sync.md`.

## File mapping

`map.json` drives all file-level decisions:

- `defaultMode: one-to-one` — most upstream `src/foo/Bar.tsx` maps to port `src/foo/Bar.tsx`
- `overrides` — known splits, renames, heavy-rewrites
- `excluded` — patterns skipped entirely (snapshots, `.d.ts` ambient files)
- `solid_additions` — port files with no upstream counterpart
- `unported_upstream` — upstream files not yet ported

When upstream adds a new file not in the map, `sync-upstream.ts status` flags it as `UNMAPPED`.

## applied.jsonl schema

Each line is a JSON object:

```json
{"sha":"<40-char>","ported_at":"YYYY-MM-DD","ported_by":"<actor>","summary":"<1-line>","files":["<solid-path>"]}
```

`ported_by` is either `baseline` (initial pin) or the GitHub handle / agent ID of whoever did the port work.
