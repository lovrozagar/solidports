import {
  createResource,
  Suspense,
  Show,
  splitProps,
  type JSX,
  type ParentProps,
} from "solid-js"
import clsx from "clsx"
import { createHighlighterCore, type HighlighterCore } from "shiki/core"
import { createOnigurumaEngine } from "shiki/engine/oniguruma"

type Lang = "tsx" | "ts" | "js" | "jsx" | "bash" | "css" | "json" | "html" | "text"

interface CodeBlockProps {
  lang?: Lang
  children: string
}

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [
        import("shiki/themes/github-dark-default.mjs"),
        import("shiki/themes/github-light-default.mjs"),
      ],
      langs: [
        import("shiki/langs/tsx.mjs"),
        import("shiki/langs/typescript.mjs"),
        import("shiki/langs/javascript.mjs"),
        import("shiki/langs/jsx.mjs"),
        import("shiki/langs/bash.mjs"),
        import("shiki/langs/css.mjs"),
        import("shiki/langs/json.mjs"),
        import("shiki/langs/html.mjs"),
      ],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    })
  }
  return highlighterPromise
}

const LANG_ALIAS: Record<string, string> = { ts: "typescript" }

function highlight(code: string, lang: Lang): Promise<string> {
  return getHighlighter().then((hl) =>
    hl.codeToHtml(code, {
      lang: LANG_ALIAS[lang] ?? lang,
      themes: {
        dark: "github-dark-default",
        light: "github-light-default",
      },
    }),
  )
}

/** Syntax-highlighted code block via shiki. Falls back to plain <pre> on client until loaded. */
export function CodeBlock(props: CodeBlockProps) {
  const lang = () => props.lang ?? "text"
  const code = () => props.children

  const [html] = createResource(
    () => ({ code: code(), lang: lang() }),
    ({ code, lang }) => highlight(code, lang as Lang),
  )

  return (
    <Suspense
      fallback={
        <pre class="CodeBlockFallback">
          <code>{code()}</code>
        </pre>
      }
    >
      <Show
        when={html()}
        fallback={
          <pre class="CodeBlockFallback">
            <code>{code()}</code>
          </pre>
        }
      >
        {/* shiki emits a <pre class="shiki ..."> — safe to innerHTML here. */}
        {/* eslint-disable-next-line solid/no-innerhtml */}
        <div class="CodeBlock" innerHTML={html()} />
      </Show>
    </Suspense>
  )
}

/* Sub-components mirror upstream `* as CodeBlock` — consumed by mdx-components.tsx
   `figure`/`figcaption`/`pre` overrides when rehype-pretty-code emits fenced output.
   docs-solid uses shiki at render time (<CodeBlock>) rather than rehype-pretty-code,
   so these wrappers are visually-minimal fallbacks that preserve upstream DOM shape. */

export function Root(props: ParentProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div role="figure" class={clsx("CodeBlockRoot", local.class)} {...rest} />
}

export function Panel(props: ParentProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <div class={clsx("CodeBlockPanel", local.class)} {...rest}>
      <div class="CodeBlockPanelTitle">{local.children}</div>
    </div>
  )
}

export function Pre(props: JSX.HTMLAttributes<HTMLPreElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <pre class={clsx("CodeBlockPre", local.class)} {...rest} />
}
