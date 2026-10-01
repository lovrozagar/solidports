import { Router } from "@solidjs/router"
import { FileRoutes } from "@solidjs/start/router"
import { Suspense, type JSX } from "solid-js"
import { MDXProvider } from "solid-mdx"
import "./css/index.css"
import { mdxComponents } from "./components/mdx-components"

/* solid-mdx types expect a flat Record<string, (props) => JSX.Element>, but our registry
   includes nested namespaces (QuickNav.*) that MDX resolves at runtime via dot-access.
   Cast through the flat shape — solid-mdx walks the tree fine at render. */
const providerComponents = mdxComponents as unknown as Record<
  string,
  (props: unknown) => JSX.Element
>

/* Root <Suspense> stays — required by SolidStart for lazyRoute asset injection
   (style tags etc.). The (docs) layout adds an INNER <Suspense> around route
   children that catches route suspensions first, so header + sidenav stay
   mounted across nav and only the main column flashes. */
export default function App() {
  return (
    <Router
      root={(props) => (
        <MDXProvider components={providerComponents}>
          <Suspense>{props.children}</Suspense>
        </MDXProvider>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
