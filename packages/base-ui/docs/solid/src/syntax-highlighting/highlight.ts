/** Escape for innerHTML. Shiki is not used on the client — it crashed Vinxi's prebundle. */
export function highlightInline(code: string, _lang: string = "tsx"): string {
  return code
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}
