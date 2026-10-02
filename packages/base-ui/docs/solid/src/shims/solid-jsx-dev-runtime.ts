/* Runtime shim for @solidjs/web/jsx-{dev-}runtime imports.
   @solidjs/vite-plugin rewrites .tsx JSX before eval, but @mdx-js/rollup
   emits jsx(...) calls that survive to runtime — notably for native HTML tags like
   `<details>`/`<summary>` MDX passes through. `createComponent(string, props)` throws
   `Comp is not a function` in SSR, so strings must route through <Dynamic>. */
import { createComponent } from 'solid-js';
import type { Component } from 'solid-js';
import { Dynamic } from '@solidjs/web';
function jsx(type: unknown, props: Record<string, unknown>) {
  if (typeof type !== "function") {
    return createComponent(Dynamic as Component<Record<string, unknown>>, {
      ...props,
      component: typeof type === "string" ? type : "span",
    })
  }
  return createComponent(type as Parameters<typeof createComponent>[0], props)
}

function Fragment(props: { children?: unknown }) {
  return props.children
}

export { jsx, jsx as jsxDEV, jsx as jsxs, Fragment }
