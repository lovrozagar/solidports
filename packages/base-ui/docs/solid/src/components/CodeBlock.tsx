import { createContext, createSignal, createUniqueId, splitProps, useContext, type JSX, type ParentProps } from "solid-js"
import clsx from "clsx"
import * as ScrollArea from "./ScrollArea"
import { CheckIcon } from "../icons/CheckIcon"
import { CopyIcon } from "../icons/CopyIcon"
import { GhostButton } from "./GhostButton"
import "./CodeBlock/CodeBlock.css"

type Lang = "tsx" | "ts" | "js" | "jsx" | "bash" | "css" | "json" | "html" | "text"

interface CodeBlockProps {
  lang?: Lang
  children: string
}

const CodeBlockContext = createContext<{ codeId: string; titleId: string }>({
  codeId: "",
  titleId: "",
})

/** Plain code block. Shiki is not loaded here — it crashed Vinxi's prebundle (`warnDeprecated`). */
export function CodeBlock(props: CodeBlockProps) {
  const lang = () => props.lang ?? "text"
  return (
    <pre class="CodeBlockFallback">
      <code class={`language-${lang()}`}>{props.children}</code>
    </pre>
  )
}

export function Root(props: ParentProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["class"])
  const titleId = createUniqueId()
  const codeId = createUniqueId()
  return (
    <CodeBlockContext.Provider value={{ codeId, titleId }}>
      <div
        role="figure"
        aria-labelledby={titleId}
        {...rest}
        class={clsx("CodeBlockRoot", local.class)}
      />
    </CodeBlockContext.Provider>
  )
}

export function Panel(
  props: ParentProps<JSX.HTMLAttributes<HTMLDivElement> & { title?: string }>,
) {
  const [local, rest] = splitProps(props, ["class", "children", "title"])
  const ctx = useContext(CodeBlockContext)
  const [copied, setCopied] = createSignal(false)
  let timer = 0

  async function copy() {
    const codeRoot = ctx.codeId ? document.getElementById(ctx.codeId) : null
    const code = codeRoot?.querySelector("pre code")?.textContent ?? codeRoot?.textContent
    if (!code) return
    await navigator.clipboard.writeText(code)
    window.clearTimeout(timer)
    setCopied(true)
    timer = window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div class={clsx("CodeBlockPanel", local.class)} {...rest}>
      {local.title != null ? (
        <>
          <span id={ctx.titleId} class="bui-sr-only">
            {local.title}
          </span>
          {local.children}
        </>
      ) : (
        <div id={ctx.titleId} class="CodeBlockPanelTitle">
          {local.children}
        </div>
      )}
      <GhostButton aria-label="Copy code" layout="icon" onClick={() => void copy()}>
        <span class="CodeBlockCopyIcon">{copied() ? <CheckIcon /> : <CopyIcon />}</span>
      </GhostButton>
    </div>
  )
}

export function Content(props: ParentProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["class", "children"])
  const ctx = useContext(CodeBlockContext)
  return (
    <ScrollArea.Root
      tabIndex={-1}
      id={ctx.codeId}
      class={clsx("CodeBlockPreContainer", local.class)}
      {...rest}
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          String.fromCharCode(event.keyCode) === "A" &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault()
          window.getSelection()?.selectAllChildren(event.currentTarget)
        }
      }}
    >
      <ScrollArea.Viewport class="CodeBlockViewport">{local.children}</ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="horizontal" />
    </ScrollArea.Root>
  )
}

export function Pre(props: JSX.HTMLAttributes<HTMLPreElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return (
    <Content>
      <pre {...rest} class={clsx("CodeBlockPreInline CodeBlockPre", local.class)} />
    </Content>
  )
}
