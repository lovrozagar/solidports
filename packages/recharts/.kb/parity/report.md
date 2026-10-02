# @solidports/recharts — API parity report

Generated: 2026-10-02T07:02:09.886Z

Status: **PASS**

## Summary

- Upstream exports: 251
- Solid exports: 252
- Common: 251
- Missing exports: 0
- Unexplained drift: 0
- Deferred (documented unported): 0
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

_(none)_

## See also

- `.kb/parity/divergences.md` — documented React→Solid type-equivalents (children, ref, events).
- `.kb/parity/todo.md` — backlog of deferred upstream symbols to port.
- `.parity/report.json` — machine-readable diff for CI.
