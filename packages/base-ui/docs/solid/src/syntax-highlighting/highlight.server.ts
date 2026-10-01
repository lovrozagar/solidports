"use server"

import { highlightInline } from "./prettylights.mjs"

/** React docs highlighter (starry-night prettylights). Server only — the grammar bundle breaks the client. */
export async function highlightCode(code: string, lang = "tsx") {
  return highlightInline(code, lang)
}
