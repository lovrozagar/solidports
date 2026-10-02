function escapeHtml(code: string): string {
  return code.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

const KEYWORDS = new Set([
  "import",
  "from",
  "export",
  "default",
  "function",
  "return",
  "const",
  "let",
  "true",
  "false",
  "null",
  "undefined",
  "string",
  "number",
  "boolean",
  "void",
  "any",
])

function span(kind: string, text: string): string {
  return `<span class="pl-${kind}">${text}</span>`
}

/** Small client-safe highlighter for API type pills. Demo blocks are highlighted at transform time by viteDemoHighlight.mjs. */
export function highlightInline(code: string, _lang = "tsx"): string {
  let html = ""
  let i = 0
  while (i < code.length) {
    const rest = code.slice(i)
    const quote = rest[0]
    if (quote === '"' || quote === "'" || quote === "`") {
      let j = 1
      while (j < rest.length && rest[j] !== quote) j += 1
      if (j < rest.length) j += 1
      html += span("s", escapeHtml(rest.slice(0, j)))
      i += j
      continue
    }
    const word = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (word) {
      const text = word[0]
      html += KEYWORDS.has(text) ? span(text === "true" || text === "false" || text === "null" || text === "undefined" ? "c1" : "k", escapeHtml(text)) : escapeHtml(text)
      i += text.length
      continue
    }
    html += escapeHtml(rest[0] ?? "")
    i += 1
  }
  return html
}
