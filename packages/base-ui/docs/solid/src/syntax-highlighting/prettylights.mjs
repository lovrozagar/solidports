import { createStarryNight } from "@wooorm/starry-night"
import sourceCss from "@wooorm/starry-night/source.css"
import sourceJs from "@wooorm/starry-night/source.js"
import sourceJson from "@wooorm/starry-night/source.json"
import sourceShell from "@wooorm/starry-night/source.shell"
import sourceTs from "@wooorm/starry-night/source.ts"
import sourceTsx from "@wooorm/starry-night/source.tsx"
import sourceYaml from "@wooorm/starry-night/source.yaml"
import textHtml from "@wooorm/starry-night/text.html.basic"
import textMd from "@wooorm/starry-night/text.md"
import { toHtml } from "hast-util-to-html"
import { extendSyntaxTokens } from "../../../react/node_modules/@mui/internal-docs-infra/pipeline/parseSource/extendSyntaxTokens.mjs"

const languageToScope = {
  js: "source.js",
  javascript: "source.js",
  ts: "source.ts",
  typescript: "source.ts",
  jsx: "source.tsx",
  tsx: "source.tsx",
  json: "source.json",
  md: "text.md",
  markdown: "text.md",
  html: "text.html.basic",
  css: "source.css",
  sh: "source.shell",
  shell: "source.shell",
  bash: "source.shell",
  yaml: "source.yaml",
  yml: "source.yaml",
}

const night = await createStarryNight([
  sourceJs,
  sourceTs,
  sourceTsx,
  sourceJson,
  textMd,
  textHtml,
  sourceCss,
  sourceShell,
  sourceYaml,
])

function scopeFor(lang) {
  return languageToScope[String(lang || "tsx").toLowerCase()] ?? "source.tsx"
}

/** Same highlighter the React docs use: starry-night prettylights plus their di-* classes. */
export function highlightInline(code, lang = "tsx") {
  const scope = scopeFor(lang)
  const tree = night.highlight(code, scope)
  extendSyntaxTokens(tree, scope)
  return toHtml(tree)
}
