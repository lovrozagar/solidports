/* Runtime shim for solid-js/jsx-{dev-}runtime imports.
   vite-plugin-solid's babel transform rewrites .tsx JSX before eval, but @mdx-js/rollup
   emits jsx(...) calls that survive to runtime — notably for native HTML tags like
   `<details>`/`<summary>` MDX passes through. `createComponent(string, props)` throws
   `Comp is not a function` in SSR, so strings must route through <Dynamic>. */
import { createComponent, type Component } from "solid-js"
import { Dynamic } from "solid-js/web"

function jsx(type: unknown, props: Record<string, unknown>) {
  if (typeof type === "string") {
    return createComponent(Dynamic as Component<Record<string, unknown>>, {
      ...props,
      component: type,
    })
  }
  return createComponent(type as Parameters<typeof createComponent>[0], props)
}

function Fragment(props: { children?: unknown }) {
  return props.children
}

export { jsx, jsx as jsxs, Fragment }
