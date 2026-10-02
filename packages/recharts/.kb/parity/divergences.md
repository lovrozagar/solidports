# Parity divergences — React → Solid framework equivalents

This file documents the **intentional, semantically-equivalent type substitutions** the port makes against upstream `recharts`. They are not regressions — they are the cost of crossing the React→Solid boundary, and consumer-visible APIs work identically modulo JSX syntax.

The audit script (`scripts/parity-audit.ts`) does **not** flag these. Anything novel that doesn't fit a category below should be raised in review.

## Children

Upstream uses `React.ReactNode`. The Solid port uses Solid's native node types — typically `JSX.Element | string | number | boolean | null | undefined`, occasionally narrowed (`JSX.Element` only) when the component cannot accept primitives.

- `React.ReactNode` ⟷ `JSX.Element | string | number | boolean | null | undefined`
- `React.ReactElement` ⟷ `JSX.Element`
- `React.FunctionComponent<P>` ⟷ `Component<P>` from `solid-js`

Why safe: structurally compatible for consumers. JSX literals (`<Foo />`), strings, numbers, and falsy values render in both runtimes; the union widens or narrows in equivalent ways.

Caveat: Solid does NOT call render-prop functions during JSX flattening — components that upstream handle as `ReactNode` (a function child) must be explicitly invoked in JSX (`{props.children(...)}`). This is documented per call site (e.g. `Customized`, `LabelList`).

## Refs

Upstream uses `React.Ref<T>` / `React.MutableRefObject<T>` / `React.RefObject<T>`. The Solid port uses Solid's ref shape:

- `React.Ref<T>` ⟷ `T | ((el: T) => void)` (Solid's native `ref={}` accepts both shapes)
- `React.MutableRefObject<T>` ⟷ `{ current: T | null }` (plain object, manually maintained)
- `React.RefObject<T>` ⟷ `{ current: T | null }`

Why safe: API-compatible. Consumers passing `ref={el => ...}` work identically. Consumers using ref-objects construct `{ current: null }` directly instead of calling `useRef`.

Caveat: Recharts internals that pass refs through render-props (notably `Curve.pathRef`) settled on the `{ current: T | null }` shape post Phase 3 session 37 — see `.kb/solid/gotchas.md` GOTCHA-014-J for the rationale (callback refs were dropped because tests assert ref-object shape on user-handler payloads).

## Event handlers

Upstream uses React's synthetic-event types: `React.MouseEventHandler<Elt>`, `React.ChangeEventHandler<Elt>`, `React.SyntheticEvent`, etc. The Solid port uses Solid's native DOM-event union types:

- `React.MouseEventHandler<Elt>` ⟷ `JSX.EventHandlerUnion<Elt, MouseEvent>`
- `React.TouchEventHandler<Elt>` ⟷ `JSX.EventHandlerUnion<Elt, TouchEvent>`
- `React.PointerEventHandler<Elt>` ⟷ `JSX.EventHandlerUnion<Elt, PointerEvent>`
- `React.ChangeEventHandler<Elt>` ⟷ `JSX.EventHandlerUnion<Elt, Event>`
- `React.SyntheticEvent<Elt>` ⟷ native DOM event (`MouseEvent`, `TouchEvent`, ...)

Why safe: handlers fire on the same DOM events with the same payload shape (`event.currentTarget`, `event.clientX`, etc.). Solid does not synthesize a wrapper — `event` is the real DOM event — but recharts handlers don't use any React-only synthetic-event APIs (no `event.persist()`, no pooling).

Caveat: when recharts hands a *handler payload* to the user (e.g. `onClick(data, index, event)` on Bar/Pie/Scatter), the `event` argument is now the native DOM event. Tests that assert `event.nativeEvent` or React-pool-specific behavior are adapted to the native event with a comment.

## CSS / SVG attribute typing

Upstream uses `React.CSSProperties` and `React.SVGProps<T>`. The Solid port uses Solid's native equivalents — but with a **JSX module augmentation** that adds React-style camelCase aliases for SVG attributes (`fillOpacity`, `strokeWidth`, `clipPath`, ...).

- `React.CSSProperties` ⟷ `JSX.CSSProperties`
- `React.SVGProps<T>` ⟷ `JSX.SvgSVGAttributes<T>` (or per-element shape) **augmented with `CamelCaseSVGAttrs`** via `src/util/solidJsxCamelAugment.d.ts`
- `React.HTMLAttributes<T>` ⟷ `JSX.HTMLAttributes<T>`

Why safe: chart components accept BOTH React-style camelCase AND Solid-native kebab-case. Runtime kebab-rekey via `SVG_CAMEL_TO_KEBAB` (in `src/util/svgPropertiesNoEvents.ts`) translates camelCase to the kebab-case attribute name the DOM expects. Documented in Phase 6.1 log entry; see `.kb/solid/gotchas.md` for the augmentation mechanism.

## Solid-specific additions

Symbols the port exports that have **no upstream counterpart**. Each is allowlisted in `scripts/parity-audit.ts::SOLID_INTENTIONAL_ADDITIONS` so the audit doesn't flag them as accidental leaks.

- `_SolidJSXCamelAugmentMarker` — module-augmentation marker. Re-exported as `type` from `src/index.ts` so importing `@solidports/recharts` transitively triggers the JSX augmentation. No runtime cost, no behavioral implication; consumers should not import or reference it.

## Upstream symbols not yet ported

Tracked in `.kb/parity/todo.md` and allowlisted in `scripts/parity-audit.ts::UPSTREAM_DEFERRED`. Current backlog (11 symbols, all related to typed-chart factory utilities):

- `createHorizontalChart`, `createVerticalChart`, `createCentricChart`, `createRadialChart` (4 value exports)
- `TypedHorizontalChartContext`, `TypedVerticalChartContext`, `TypedCentricChartContext`, `TypedRadialChartContext`, `NoFunnel`, `NoRadial`, `NoCentric` (7 type exports)

These are convenience generic-typed wrappers for end-users — they don't power any internal chart logic. Deferred to a post-consumer-validation pass. See `.upstream/map.json::unported_upstream`.

## Test lint overrides

`.oxlintrc.json` turns off `vitest/valid-title`, `vitest/require-to-throw-message` and `unicorn/no-new-array` for test files. Ported upstream specs use titles with trailing spaces or duplicate prefixes, bare `toThrow()`, and `new Array(n)` verbatim; titles must stay identical for the test-parity audit.
