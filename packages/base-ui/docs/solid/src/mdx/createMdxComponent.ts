import { evaluate, type EvaluateOptions } from "@mdx-js/mdx"
/* MDX evaluate needs a {jsx,jsxs,jsxDEV,Fragment} runtime. The docs Vite config
   aliases @solidjs/web/jsx-runtime to the local shim that routes native tags
   through Dynamic. */
import * as jsxRuntime from "../shims/solid-jsx-runtime"

/** MDX runtime compile — parity with upstream `docs/src/mdx/createMdxComponent.ts`.
    Upstream uses React jsx-runtime; we use the Solid 2 jsx shim for SSR-friendly eval.
    Only called by rehype-driven heading/subtitle extraction paths, not render-time. */
export async function createMdxComponent(
  markdown = "",
  options: Partial<Record<keyof EvaluateOptions, unknown>> = {},
) {
  const { default: Component } = await evaluate(markdown, {
    ...(jsxRuntime as unknown as EvaluateOptions),
    ...options,
  } as EvaluateOptions)
  return Component
}
