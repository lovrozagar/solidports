import { defineConfig } from "@solidjs/start/config"
import mdx from "@mdx-js/rollup"
import remarkGfm from "remark-gfm"
import remarkTypography from "remark-typography"
import rehypeExtractToc from "@stefanprobst/rehype-extract-toc"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"
const libPkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../packages/solid/package.json", import.meta.url)), "utf-8"),
) as { version: string }
import { rehypeSlug } from "./src/components/QuickNav/rehypeSlug.mjs"
import { rehypeConcatHeadings } from "./src/components/QuickNav/rehypeConcatHeadings.mjs"
import { rehypeQuickNav } from "./src/components/QuickNav/rehypeQuickNav.mjs"
import { rehypeSubtitle } from "./src/components/Subtitle/rehypeSubtitle.mjs"
import { rehypeKbd } from "./src/components/Kbd/rehypeKbd.mjs"
import { rehypeReference } from "./src/components/ReferenceTable/rehypeReference.mjs"
import { rehypeSyntaxHighlighting } from "./src/syntax-highlighting/index.mjs"


export default defineConfig({
  extensions: ["tsx", "ts", "mdx", "md"],
  vite: {
    css: {
      postcss: fileURLToPath(new URL("./postcss.config.js", import.meta.url)),
    },
    define: {
      "import.meta.env.VITE_LIB_VERSION": JSON.stringify(libPkg.version),
    },
    plugins: [
      tailwindcss(),
      {
        ...mdx({
          /* vite-plugin-solid handles JSX transform — don't override jsxImportSource.
             solid-js/jsx-dev-runtime maps to solid.js (no jsxDEV export) and solid-js/h
             is DOM-only (breaks SSR). The babel solid transform rewrites JSX before eval. */
          jsxImportSource: "solid-js",
          providerImportSource: "solid-mdx",
          remarkPlugins: [remarkGfm, remarkTypography],
          /* Order matters: rehypeReference expands <Reference /> into tables first,
             then rehype-pretty-code paints the materialized <code> nodes, then
             slug/toc/quicknav run on the fully-highlighted tree. */
          rehypePlugins: [
            rehypeReference,
            ...rehypeSyntaxHighlighting,
            rehypeSlug,
            rehypeConcatHeadings,
            rehypeExtractToc,
            rehypeQuickNav,
            rehypeSubtitle,
            rehypeKbd,
          ],
        }),
        enforce: "pre",
      },
    ],
    resolve: {
      alias: {
        /* pnpm publishConfig.directory links workspace dep to build/ which has no package.json;
           alias to source directly so vite resolves subpath exports via index.ts */
        "@solidports/base-ui": fileURLToPath(
          new URL("../../packages/solid/src", import.meta.url),
        ),
        docs: fileURLToPath(new URL(".", import.meta.url)),
        /* solid-js/jsx-dev-runtime + /jsx-runtime both resolve to solid.js which lacks
           jsx/jsxs/jsxDEV exports. MDX emits these imports; vite-plugin-solid babel transform
           rewrites the JSX calls before evaluation, so these fns are never called — shims
           satisfy the resolver. Dev uses -dev, prod uses bare. */
        "solid-js/jsx-dev-runtime": fileURLToPath(
          new URL("./src/shims/solid-jsx-dev-runtime.ts", import.meta.url),
        ),
        "solid-js/jsx-runtime": fileURLToPath(
          new URL("./src/shims/solid-jsx-runtime.ts", import.meta.url),
        ),
      },
    },
  },
})
