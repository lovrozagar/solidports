import { createContext, useContext, type ParentProps } from "solid-js"
import type { JSX } from "@solidjs/web"
import { Dynamic } from "@solidjs/web"
import { mdxComponents } from "../components/mdx-components"

type MDXComponent = (props: Record<string, unknown>) => JSX.Element
export type MDXComponents = Record<string, MDXComponent | MDXComponents | undefined>

const MDXContext = createContext<MDXComponents>({})

/** MDX's generated `_components` table defaults every HTML tag to a string
 *  (`p: "p"`). Solid 2 `createComponent` rejects strings, so every tag we
 *  don't override with a real component must be a function. */
const HTML_TAGS = [
	"a",
	"article",
	"aside",
	"blockquote",
	"br",
	"code",
	"del",
	"details",
	"div",
	"em",
	"figcaption",
	"figure",
	"footer",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hr",
	"img",
	"ins",
	"kbd",
	"li",
	"main",
	"mark",
	"nav",
	"ol",
	"p",
	"pre",
	"section",
	"span",
	"strong",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"th",
	"thead",
	"tr",
	"ul",
] as const

function htmlTag(tag: string): MDXComponent {
	return (props) => <Dynamic component={tag} {...props} />
}

const htmlComponents: MDXComponents = Object.fromEntries(
	HTML_TAGS.map((tag) => [tag, htmlTag(tag)]),
)

function wrapStrings(components: MDXComponents): MDXComponents {
	const out: MDXComponents = {}
	for (const key of Object.keys(components)) {
		const value = components[key]
		if (typeof value === "string") {
			out[key] = htmlTag(value)
		} else {
			out[key] = value
		}
	}
	return out
}

export function MDXProvider(props: ParentProps<{ components?: MDXComponents }>) {
	const parent = useContext(MDXContext)
	return (
		<MDXContext value={{ ...parent, ...(props.components ?? {}) }}>{props.children}</MDXContext>
	)
}

export function useMDXComponents(): MDXComponents {
	const ctx = useContext(MDXContext)
	return {
		...htmlComponents,
		...wrapStrings(mdxComponents as MDXComponents),
		...wrapStrings(ctx),
	}
}

export { MDXContext }
