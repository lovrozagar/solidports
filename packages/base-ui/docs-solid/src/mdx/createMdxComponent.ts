import { evaluate, type EvaluateOptions } from "@mdx-js/mdx"
/* solid-js/jsx-runtime is shimmed by app.config.ts alias — vite-plugin-solid babel
   rewrites the JSX calls before evaluation so these fns are never executed. Here
   we pass a resolved jsx runtime shape {jsx,jsxs,jsxDEV,Fragment} into mdx/evaluate. */
import * as jsxRuntime from "solid-js/h/jsx-runtime"

/** MDX runtime compile — parity with upstream `docs/src/mdx/createMdxComponent.ts`.
    Upstream uses React jsx-runtime; we use solid-js/h/jsx-runtime for SSR-friendly eval.
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
