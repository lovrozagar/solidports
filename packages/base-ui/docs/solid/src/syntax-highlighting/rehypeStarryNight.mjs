import { fromHtml } from "hast-util-from-html"
import { toString } from "hast-util-to-string"
import { visit } from "unist-util-visit"
import { highlightInline } from "./prettylights.mjs"

function languageOf(node) {
  const className = node.properties?.className
  const classes = Array.isArray(className) ? className : []
  const match = classes.map(String).find((name) => name.startsWith("language-"))
  if (match) return match.slice("language-".length)
  const data = node.properties?.dataLanguage
  return typeof data === "string" && data ? data : "tsx"
}

/** Replace shiki's inline colors with the React docs prettylights classes. */
export function rehypeStarryNight() {
  return (tree) => {
    visit(tree, "element", (node, _index, parent) => {
      if (node.tagName !== "code" || parent?.tagName !== "pre") return
      const lang = languageOf(node)
      const source = toString(node).replace(/\n$/, "")
      const html = highlightInline(source, lang)
      node.children = html.split("\n").map((line) => {
        const fragment = fromHtml(line.length ? line : " ", { fragment: true })
        return {
          type: "element",
          tagName: "span",
          properties: { className: ["line"], "data-line": "" },
          children: fragment.children,
        }
      })
      if (node.properties?.style) delete node.properties.style
      if (parent.properties?.style) delete parent.properties.style
    })
  }
}
