# @solidports/recharts — API parity report

Generated: 2026-04-26T13:13:18.518Z

Status: **PASS**

## Summary

- Upstream exports: 216
- Solid exports: 206
- Common: 205
- Missing exports: 0
- Unexplained drift: 0
- Deferred (documented unported): 11
- Extras (Solid-only, allowlisted): 1
- Extras (Solid-only, unexplained): 0

## Missing exports

Symbols upstream exports that the Solid port does not. **Block ship.**

_(none)_

## Kind drift (value vs type)

Symbols where upstream and Solid disagree on whether the export is a value or a type-only export. Indicates structural drift.

_(none)_

## Unexplained extras

Solid exports that have no upstream counterpart and no entry in `SOLID_INTENTIONAL_ADDITIONS`. Investigate before shipping — accidental leak or missing allowlist entry.

_(none)_

## Deferred (documented unported)

Upstream exports that the port has explicitly chosen not to implement yet. Tracked in `.kb/parity/todo.md` with a target phase.

- `createHorizontalChart` (value) — Typed-chart factory utility; deferred — see .upstream/map.json::unported_upstream.
- `createVerticalChart` (value) — Typed-chart factory utility; deferred — see .upstream/map.json::unported_upstream.
- `createCentricChart` (value) — Typed-polar factory utility; deferred — see .upstream/map.json::unported_upstream.
- `createRadialChart` (value) — Typed-polar factory utility; deferred — see .upstream/map.json::unported_upstream.
- `TypedHorizontalChartContext` (type) — Companion type for createHorizontalChart; deferred.
- `TypedVerticalChartContext` (type) — Companion type for createVerticalChart; deferred.
- `NoFunnel` (type) — Companion type for cartesian factories; deferred.
- `TypedCentricChartContext` (type) — Companion type for createCentricChart; deferred.
- `TypedRadialChartContext` (type) — Companion type for createRadialChart; deferred.
- `NoRadial` (type) — Companion type for polar factories; deferred.
- `NoCentric` (type) — Companion type for polar factories; deferred.

## See also

- `.kb/parity/divergences.md` — documented React→Solid type-equivalents (children, ref, events).
- `.kb/parity/todo.md` — backlog of deferred upstream symbols to port.
- `.parity/report.json` — machine-readable diff for CI.
