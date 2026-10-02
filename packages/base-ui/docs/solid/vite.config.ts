import { defineConfig } from "vite"
import solid from "@solidjs/vite-plugin"
import { fileRoutes } from "filesystem-routing/vite"
import mdx from "@mdx-js/rollup"
import remarkGfm from "remark-gfm"
import remarkTypography from "remark-typography"
import rehypeExtractToc from "@stefanprobst/rehype-extract-toc"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"
import { rehypeSlug } from "./src/components/QuickNav/rehypeSlug.mjs"
import { rehypeConcatHeadings } from "./src/components/QuickNav/rehypeConcatHeadings.mjs"
import { rehypeQuickNav } from "./src/components/QuickNav/rehypeQuickNav.mjs"
import { rehypeSubtitle } from "./src/components/Subtitle/rehypeSubtitle.mjs"
import { rehypeKbd } from "./src/components/Kbd/rehypeKbd.mjs"
import { rehypeReference } from "./src/components/ReferenceTable/rehypeReference.mjs"
import { rehypeSyntaxHighlighting } from "./src/syntax-highlighting/index.mjs"
import { demoHighlight } from "./src/syntax-highlighting/viteDemoHighlight.mjs"

const libPkg = JSON.parse(
	readFileSync(fileURLToPath(new URL("../../packages/solid/package.json", import.meta.url)), "utf-8"),
) as { version: string }

const jsxRuntime = fileURLToPath(new URL("./src/shims/solid-jsx-runtime.ts", import.meta.url))
const jsxDevRuntime = fileURLToPath(new URL("./src/shims/solid-jsx-dev-runtime.ts", import.meta.url))
const solidJsWeb = fileURLToPath(new URL("./src/shims/solid-js-web.ts", import.meta.url))
const solidMdx = fileURLToPath(new URL("./src/shims/solid-mdx.tsx", import.meta.url))

export default defineConfig({
	css: {
		postcss: fileURLToPath(new URL("./postcss.config.js", import.meta.url)),
	},
	define: {
		"import.meta.env.VITE_LIB_VERSION": JSON.stringify(libPkg.version),
	},
	plugins: [
		demoHighlight(),
		// MDX must run before Solid: both are `enforce: "pre"`, so array order
		// is the transform order. Solid compiling raw markdown throws
		// `Invalid Character`. `jsx: true` leaves JSX for the Solid compiler.
		{
			...mdx({
				jsxImportSource: "@solidjs/web",
				providerImportSource: solidMdx,
				remarkPlugins: [remarkGfm, remarkTypography],
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
		solid({
			start: true,
			ssr: true,
			extensions: [".jsx", ".tsx", ".mdx", ".md"],
		}),
		fileRoutes({
			types: true,
			extensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
		}),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"@solidports/base-ui": fileURLToPath(new URL("../../packages/solid/src", import.meta.url)),
			docs: fileURLToPath(new URL(".", import.meta.url)),
			"solid-js/jsx-dev-runtime": jsxDevRuntime,
			"solid-js/jsx-runtime": jsxRuntime,
			"solid-js/web": solidJsWeb,
			"solid-js/store": "solid-js",
			"solid-mdx": solidMdx,
			"@solidjs/web/jsx-dev-runtime": jsxDevRuntime,
			"@solidjs/web/jsx-runtime": jsxRuntime,
		},
	},
	optimizeDeps: {
		exclude: ["solid-mdx", "lucide-solid"],
	},
})
