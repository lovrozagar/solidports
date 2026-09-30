# @solidports/recharts-examples-visual

Playwright visual regression harness — diffs the SolidJS port (`examples/basic`, port 5173) against the upstream React reference (`examples/react`, port 5174) for all 12 chart stories.

## What it does

- Boots both Vite dev servers in parallel via Playwright `webServer`.
- For each chart route (`line`, `bar`, `area`, `composed`, `pie`, `radar`, `radial`, `scatter`, `funnel`, `sankey`, `treemap`, `sunburst`):
	1. Navigates the React app to `#/<id>`, waits for `.recharts-wrapper` + 2 animation frames.
	2. Captures `<main>` as PNG. On first run (or with `UPDATE_REFERENCE=1`) this is written to `tests/__snapshots__/react-reference/<id>.png` as the committed baseline.
	3. Navigates the Solid app to `#/<id>`, captures the same way → `tests/__snapshots__/solid-actual/<id>.png`.
	4. Diffs Solid vs the committed React reference using `pixelmatch`. Writes the diff PNG to `tests/__snapshots__/diffs/<id>.png` regardless of pass/fail.
	5. Soft-asserts that the diff pixel ratio is within 5%. `expect.soft` lets all 12 charts run even when one fails — the report shows every mismatch.

## Run

From this directory:

```bash
bun install                  # once — workspace install at repo root is enough
bunx playwright install      # once — chromium binary
bun run visual               # run all chart diffs
bun run visual:report        # open the HTML report
```

From repo root:

```bash
bun run --filter @solidports/recharts-examples-visual visual
```

## Update baselines

When the React reference itself changes (upstream recharts sync) or you intentionally accept a new render:

```bash
UPDATE_REFERENCE=1 bun run visual
```

This rewrites every `react-reference/<id>.png` from a fresh React capture. Review the diffs in git before committing.

## Snapshot strategy

The baseline IS the React render — the Solid port's contract is to match it 1:1. The reference PNGs live in `tests/__snapshots__/react-reference/` and are committed. CI re-runs both apps live each time, captures both, and compares Solid against the committed React PNG.

- Real Solid regression: Solid render drifts from committed React PNG → diff ratio > 5% → test fails.
- Upstream React change: re-capture both, run `UPDATE_REFERENCE=1`, review.
- The Solid actual + the diff PNG are also written every run for inspection — they are gitignored (regenerable artifacts).

## Files

```
examples/visual/
	package.json
	playwright.config.ts                  # two webServers (5173 Solid, 5174 React), chromium only, 1280x720
	tests/
		charts.spec.ts                      # 12 chart diff tests + 2 smoke tests
		__snapshots__/
			react-reference/<id>.png          # COMMITTED — the baseline
			solid-actual/<id>.png             # gitignored — last Solid capture
			diffs/<id>.png                    # gitignored — last pixelmatch diff
	playwright-report/                    # gitignored — HTML report
```

## Tolerance rationale

- `MAX_DIFF_PIXEL_RATIO = 0.05` — up to 5% of pixels may differ. Catches structural drift (missing axis, wrong color, shifted bar) while absorbing sub-pixel font/AA noise that varies per-OS.
- `PIXELMATCH_THRESHOLD = 0.2` — per-pixel YIQ distance tolerance. 0.2 handles anti-aliased edges; lower values false-positive on stroke joins.
- Run on Linux for stable baselines; macOS/Windows font rendering will diff. CI must use Linux runners. The committed PNGs are Linux/chromium captures.

## Constraints

- Single browser (chromium) — visual fidelity, not cross-browser coverage.
- `workers: 1` — both dev servers share one Playwright pipeline; serial avoids port + GPU contention.
- No browser binaries committed — `bunx playwright install` fetches them.
- `expect.soft` on the diff assertion — surfaces every mismatch in one run instead of stopping at the first.
