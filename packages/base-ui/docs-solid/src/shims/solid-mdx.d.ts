declare module "solid-mdx" {
  import type { ParentProps, JSX } from "solid-js"

  export function MDXProvider(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: ParentProps<{ components?: Record<string, (props: any) => JSX.Element> }>,
  ): JSX.Element

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useMDXComponents(): Record<string, (props: any) => JSX.Element>

  export const MDXContext: ReturnType<typeof import("solid-js").createContext>
}
