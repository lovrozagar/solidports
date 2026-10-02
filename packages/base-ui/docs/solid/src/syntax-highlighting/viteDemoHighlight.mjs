import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { highlightInline } from "./prettylights.mjs"

const QUERY = "?highlighted"
const PREFIX = "\0demo-highlight:"

/** Shared `_index.module.css` is shown as `index.module.css`, matching the React docs file tab. */
function displaySource(text) {
  return text.replace(/from ['"](?:\.\.\/)+_index\.module\.css['"]/g, "from './index.module.css'")
}

/**
 * Serves `<file>?highlighted` as `{ text, html }`, highlighted in Node with the same
 * starry-night pipeline the MDX code blocks use. Keeps the grammar bundle and its
 * Oniguruma WASM out of the client, which exhausts renderer memory on some demo pages.
 * The id is encoded so extension-based plugins (css, solid) never transform it.
 */
export function demoHighlight() {
  return {
    name: "docs:demo-highlight",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.endsWith(QUERY) || !importer) return null
      const file = resolve(dirname(importer.replace(PREFIX, "")), source.slice(0, -QUERY.length))
      return PREFIX + Buffer.from(file).toString("base64url")
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null
      const file = Buffer.from(id.slice(PREFIX.length), "base64url").toString()
      this.addWatchFile(file)
      const text = displaySource(readFileSync(file, "utf8"))
      const html = highlightInline(text, file.endsWith(".css") ? "css" : "tsx")
      return `export default ${JSON.stringify({ text, html })}`
    },
  }
}
