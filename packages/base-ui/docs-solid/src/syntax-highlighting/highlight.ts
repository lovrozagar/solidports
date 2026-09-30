import { getHighlighter } from "./highlighter"

/* Returns raw HTML spans with inline `color: var(--syntax-*)` styles.
   Strips the outer `<pre class="shiki ..."><code>...</code></pre>` wrapper
   so callers can inject into their own `<code>` node via innerHTML. */
export function highlightInline(code: string, lang: string = "tsx"): string {
  const highlighter = getHighlighter()
  const html = highlighter.codeToHtml(code, { lang, theme: "base-ui" })
  return html
    .replace(/^<pre[^>]*><code[^>]*>/, "")
    .replace(/<\/code><\/pre>\s*$/, "")
}
