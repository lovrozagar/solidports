import rehypePrettyCode from "rehype-pretty-code"
import { getHighlighter } from "./highlighter.ts"
import { rehypeInlineCode } from "./rehypeInlineCode.mjs"
import { rehypePrettierIgnore } from "./rehypePrettierIgnore.mjs"
import { rehypeJsxExpressions } from "./rehypeJsxExpressions.mjs"

/** @type {import('unified').PluggableList} */
export const rehypeSyntaxHighlighting = [
  [
    rehypePrettyCode,
    {
      getHighlighter: () => getHighlighter(),
      grid: false,
      theme: "base-ui",
      defaultLang: "tsx",
    },
  ],
  rehypePrettierIgnore,
  rehypeJsxExpressions,
  rehypeInlineCode,
]
