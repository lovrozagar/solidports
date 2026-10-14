import { readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { highlightInline } from "./prettylights.mjs"

const QUERY = "?highlighted"
const PREFIX = "\0demo-highlight:"

/** Shared `_index.module.css` is shown as `index.module.css`, matching the React docs file tab. */
function displaySource(text) {
  return text.replace(/from ['"](?:\.\.\/)+_index\.module\.css['"]/g, "from './index.module.css'")
}

/** The file a demo-highlight id stands for (a path relative to `root`). */
function decode(id, root) {
  return resolve(root, Buffer.from(id.slice(PREFIX.length), "base64url").toString())
}

/**
 * Serves `<file>?highlighted` as `{ text, html }`, highlighted in Node with the same
 * starry-night pipeline the MDX code blocks use. Keeps the grammar bundle and its
 * Oniguruma WASM out of the client, which exhausts renderer memory on some demo pages.
 * The id is encoded so extension-based plugins (css, solid) never transform it. It encodes the
 * path relative to the project root: a module's id names its chunk, and an encoded absolute path
 * outgrows the file name limit in a deep checkout.
 */
export function demoHighlight() {
  let root = process.cwd()
  return {
    name: "docs:demo-highlight",
    enforce: "pre",
    configResolved(config) {
      root = config.root
    },
    resolveId(source, importer) {
      if (!source.endsWith(QUERY) || !importer) {return null}
      const importerFile = importer.startsWith(PREFIX) ? decode(importer, root) : importer
      const file = resolve(dirname(importerFile), source.slice(0, -QUERY.length))
      return PREFIX + Buffer.from(relative(root, file)).toString("base64url")
    },
    load(id) {
      if (!id.startsWith(PREFIX)) {return null}
      const file = decode(id, root)
      this.addWatchFile(file)
      const text = displaySource(readFileSync(file, "utf8"))
      const html = highlightInline(text, file.endsWith(".css") ? "css" : "tsx")
      return `export default ${JSON.stringify({ text, html })}`
    },
  }
}
