import { createHighlighterCoreSync, type HighlighterCore } from "@shikijs/core"
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript"
import tsxLang from "@shikijs/langs/tsx"
import jsxLang from "@shikijs/langs/jsx"
import cssLang from "@shikijs/langs/css"
import { theme } from "./theme"

/* Sync core avoids top-level await — Vinxi/Nitro bundles server output to
   es2019 by default and TLA breaks the final Nitro step. Oniguruma WASM is
   async-only, so we use the JavaScript regex engine (no WASM load required). */
declare global {
  // eslint-disable-next-line no-var
  var __shiki__: HighlighterCore | undefined
}

export function getHighlighter(): HighlighterCore {
  if (!globalThis.__shiki__) {
    globalThis.__shiki__ = createHighlighterCoreSync({
      themes: [theme],
      langs: [tsxLang, jsxLang, cssLang],
      engine: createJavaScriptRegexEngine(),
    })
  }
  return globalThis.__shiki__
}
