# Props and context patterns — @solidports/recharts

## className vs class

Public API: always `className`. Internal native elements: either works, prefer `className` for consistency.

Never rename a public prop from `className` to `class`. The upstream recharts API uses `className` on every component — consumers depend on this name. See GOTCHA-001 in `gotchas.md`.

```tsx
/* CORRECT — public prop typed className, passed straight through */
type DotProps = { className?: string }
const Dot = (props: DotProps) => <circle class={props.className} />

/* WRONG — renames public API to class; breaks upstream consumers */
type DotProps = { class?: string }
```

The solid rule `no-react-specific-props` is `off` in `.oxlintrc.json`. Do not re-enable it.

## DotsProps / DotItem polymorphism

`Dots.tsx` renders a list of `DotItem` components. `DotsProps` defines `dotClassName?: string` for the outer prop; `DotItem` accepts `className?: string` (its own prop name). The call sites (`Line.tsx`, `Area.tsx`, `Radar.tsx`) pass `className={props.dotClassName}` — never `class=`.

## UpdatableChartOptions

`ReportChartProps` accepts `UpdatableChartOptions` (from `src/state/rootPropsSlice.ts`). The field is `className: string | undefined`. Callers (`CartesianChart.tsx`, `PolarChart.tsx`) must pass `className=` not `class=`. Passing `class=` causes a TS error because `class` is not a member of `UpdatableChartOptions`.

## Spreading props into typed functions

When forwarding a superset of props (e.g., `ContentProps extends Props`) to a function typed as `(p: Props) => JSX.Element`, use `Object.assign` rather than an object literal spread to avoid TS excess-property errors:

```ts
/* object literal — TS flags extra fields */
fn({ ...supersetProps, extra: value })

/* Object.assign — no excess-property check */
fn(Object.assign({}, supersetProps, { extra: value }) as Props)
```

Only use this pattern when the extra fields are intentionally forwarded and the callee ignores them at runtime.

## Solid ref bindings

Solid uses `ref={el}` where `el` is a `let` variable. The oxlint rule `no-unassigned-vars` does not understand this and would flag the `let ref` as never assigned. The rule is turned `off` in `.oxlintrc.json`.

```tsx
let pathRef: SVGPathElement | undefined
onMount(() => {
    if (pathRef) pathRef.getTotalLength()
})
return <path ref={pathRef} />
/* Solid assigns pathRef at mount — linter cannot see this */
```
