import { Loading } from "solid-js"
import type { JSX } from "@solidjs/web"
import { MDXProvider } from "./shims/solid-mdx"
import { Router } from "./router"
import "./css/index.css"
import { mdxComponents } from "./components/mdx-components"

/* solid-mdx types expect a flat Record<string, (props) => JSX.Element>, but our registry
   includes nested namespaces (QuickNav.*) that MDX resolves at runtime via dot-access.
   Cast through the flat shape — solid-mdx walks the tree fine at render. */
const providerComponents = mdxComponents as unknown as Record<
	string,
	(props: unknown) => JSX.Element
>

export default function App() {
	return (
		<Router>
			{props => (
				<MDXProvider components={providerComponents}>
					<Loading>{props.children}</Loading>
				</MDXProvider>
			)}
		</Router>
	)
}
