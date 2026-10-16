---
tags: [solid, refs, events, delegation]
sources: [packages/base-ui/packages/solid/src/utils/useRenderElement.tsx, packages/base-ui/packages/solid/src/merge-props/mergeProps.ts, packages/base-ui/packages/solid/src/utils/isEventHandlerKey.ts, packages/base-ui/packages/solid/src/utils/withCaptureListeners.ts, packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/field/control/FieldControl.tsx]
verified: 2026-10-16
---

# Refs and events

Solid applies refs once, ownerless, and never with `null`. In rc.15 only `on` plus an uppercase letter is an event handler: `on:`, `oncapture:` and lowercase `onclick` compile to attributes. Delegated handlers live on the element as `_$$<event>` and are dispatched from the render root.

Runtime lines cite `node_modules/@solidjs/web/dist/web.js` (rc.15). Compiler output was produced locally with the installed `@solidjs/compiler` and `@solidjs/babel-plugin` rc.15, which emit the same code.

## Refs

- **Compiled `ref={x}`:** if `x` is a function or an array, it compiles to `ref(() => x, el)`. That resolves `x` untracked and applies it ownerless (`web.js:822`). Arrays are flattened and each function is called with the element (`:820`). Otherwise the compiler assigns the variable (`x = el`).
- **Contract:** a compiled ref is called once, right after the template is cloned and before the element is returned to its parent, so usually before it is connected. It is never called with `null`, and its return value is ignored.
- **Spread `ref`:** `spread()` re-applies a ref when its identity changes (`web.js:712`).
- **Placement:** pass `ref` as a top-level JSX attribute. A `ref` nested in a props bag is not wired by the compiler.
- **Render props:** Solid has no `forwardRef`. A `render` function receives props that include `ref`, so spread them or pass `ref={props.ref}` to the element.

### Refs in `useRenderElement`

`useRenderElement` emulates React ref semantics for parts (`src/utils/useRenderElement.tsx:205-345`):

- It collects refs from:
  - the component's `ref` prop;
  - the `render` props;
  - a React-style element ref;
  - each part props source;
  - `params.ref`.
- `mergeProps` chains refs and tags the chain with `MERGED_REFS` (`merge-props/mergeProps.ts:416`), so each distinct callback runs once.
- A replacement callback is called with the element. A replaced one is not called with `null`.
- A callback's returned function is stored as its cleanup (React 19 refs).
- Object refs (`{ current }`) are set, and cleared when removed.
- On unmount, only the part's own `params.ref` callbacks run their cleanup or receive `null`. Ported registration logic depends on that. User refs keep Solid's contract.
- `applyRef` also focuses an element that has `autofocus` (`solid-helpers.tsx:58`), because browsers ignore the attribute on elements inserted after load.

## Event handler keys

- The runtime treats a key as a handler only when it is `on` followed by an uppercase letter (`assignProp`, `web.js:1648`). The port's `isEventHandlerKey` (`src/utils/isEventHandlerKey.ts`) uses the same test.
- Any other `on*` key, in JSX or in a spread, goes through `setAttribute`.

### `on:`, `oncapture:` and lowercase handlers (rc.15)

Compiling `<button on:keydown={k} oncapture:click={c} onclick={l}>` with rc.15 produces no listener. The values join the template's grouped `effect`, and each is written with `setAttribute(el, "on:keydown", k)`, so the function is stringified into an attribute.

| Source | rc.13 output | rc.15 output |
| --- | --- | --- |
| `on:keydown={k}` | `addEvent(el, ":keydown", k)` (dead listener) | `setAttribute(el, "on:keydown", k)` |
| `oncapture:click={c}` | `addEvent(el, "capture:click", c)` (dead) | `setAttribute(el, "oncapture:click", c)` |
| `onclick={l}` | delegated click (collides with `onClick`) | `setAttribute(el, "onclick", l)` |

The port has none of these. Capture-phase listeners attach through the `withCaptureListeners` ref factory (`src/utils/withCaptureListeners.ts`), used by `TabsTab`, `ComboboxItem`, `RadioGroup` and `useDismiss`.

## Delegation

- **Delegated events** (`DelegatedEvents`, `web.js:36`):
  - `beforeinput`, `click`, `dblclick`, `contextmenu`;
  - `focusin`, `focusout`, `input`, `keydown`, `keyup`;
  - `mousedown`, `mousemove`, `mouseout`, `mouseover`, `mouseup`;
  - `pointerdown`, `pointermove`, `pointerout`, `pointerover`, `pointerup`;
  - `touchstart`, `touchmove`, `touchend`.

  Not delegated: `focus`, `blur`, `change`, `scroll`, `wheel`, and the `*enter`/`*leave` events. These get one `addEventListener` each.
- **Storage:** `addEvent(el, "click", h, true)` stores `el._$$click = h`. The key prefix is `"_$$"` (`web.js:358`); rc.13 used `$$click`.
- **Tuple:** `onClick={[fn, data]}` compiles to `el._$$click = fn; el._$$clickData = data` and dispatches as `fn.call(el, data, event)`. No per-element closure.
- **Read once:** a compiled `onClick={props.onClick}` is read once at setup and is not reactive. A spread re-assigns handlers when they change: delegated handlers by property, others by remove and re-add, keeping tuple identity (`web.js:1651`).
- **Where listeners live:** delegated listeners attach to each `render()`/`hydrate()` root (`web.js:411`) and to every `Portal` mount node outside that root (`:2142`), not to `document`. An element outside every registered root never gets its delegated handlers.
- **Dispatch** (`eventHandler`, `web.js:1672`): the walk starts at the `composedPath()` target and climbs to the root, calling `_$$<type>` on each node.
  - A node with `disabled` set has its handler skipped, but the walk continues (`:1694`).
  - `currentTarget` is redefined per node, and `stopPropagation()` ends the walk.
  - Delegated handlers run when the event reaches the root, after native listeners on the elements in between. A native listener that stops propagation below the root silences them.

## Input events

- `onInput` fires per keystroke, while `onChange` is the native `change` event (commit or blur). React's `onChange` on text controls ports to `onInput` (`field/control/FieldControl.tsx:216`).

## Base UI handler merging

`mergeProps` (`src/merge-props/mergeProps.ts:463`) merges the consumer's handler with the part's:

- The consumer's handler runs first. The part's handler runs unless the consumer called `event.preventBaseUIHandler()` (`makeEventPreventable`, `:508`).
- Every merged handler runs untracked (`untrackedHandler`), because events can fire inside an effect (an effect calling `focus()`).
- The case-insensitive `on*` chaining inside props views is described in [render pipeline](../architecture/render-pipeline.md).

## Related

- [Reactivity](reactivity.md), [primitive costs](primitive-costs.md), [gotchas](gotchas.md).
