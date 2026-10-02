import { Show } from 'solid-js';
import type { ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Collapsible } from "@solidports/base-ui/collapsible"
import { ScrollArea as BaseScrollArea } from "@solidports/base-ui/scroll-area"
import * as ScrollArea from "../ScrollArea"
import type { DemoFile } from "./useDemo"
import "./CodeHighlighting.css"

interface DemoCodeBlockProps {
  selectedFile: DemoFile | undefined
  selectedFileLines: number
  collapsibleOpen: boolean
  /** How many lines should the code block have to get collapsed instead of rendering fully */
  collapsibleLinesThreshold?: number
  collapsibleTriggerRef?: (el: HTMLElement | null | undefined) => void
  copyButton?: JSX.Element
}

/* Renders the highlighted code inline. Lives in the consumer (not useDemo) so the
   `<pre>`/`<code>` template participates in the parent component's hydration walk —
   creating it inside a memo broke hydration markers. */
function HighlightedCode(props: { file: DemoFile | undefined }) {
  const lang = () => props.file?.lang ?? "text"
  return (
    <pre class="shiki" data-language={lang()} style={{ "white-space": "pre", margin: "0" }}>
      <code>
        <Show
          when={props.file?.html}
          fallback={<span class="frame" data-frame-type="focus">{props.file?.text}</span>}
        >
          {(html) => <span class="frame" data-frame-type="focus" innerHTML={html()} />}
        </Show>
      </code>
    </pre>
  )
}

function Root(props: ParentProps<{ closed?: boolean }>) {
  /* The scroll root is the flex card. Copy and Hide code position against it. */
  let rootEl: HTMLDivElement | undefined
  return (
    <BaseScrollArea.Root
      ref={(el: HTMLDivElement | null) => {
        rootEl = el ?? undefined
      }}
      class="DemoCodeBlockRoot"
      data-closed={props.closed ? "" : undefined}
      tabindex={-1}
      onKeyDown={(event: KeyboardEvent) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          String.fromCharCode(event.keyCode) === "A" &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault()
          if (rootEl) window.getSelection()?.selectAllChildren(rootEl)
        }
      }}
    >
      {props.children}
    </BaseScrollArea.Root>
  )
}

function Source(props: { file: DemoFile | undefined }) {
  return (
    <div class="DemoSourceBrowser" data-language={props.file?.lang ?? "text"}>
      <HighlightedCode file={props.file} />
    </div>
  )
}

export function DemoCodeBlock(props: DemoCodeBlockProps) {
  const threshold = () => props.collapsibleLinesThreshold ?? 8
  const collapsed = () => props.selectedFileLines >= threshold() && !props.collapsibleOpen

  return (
    <Show
      when={props.selectedFileLines >= threshold()}
      fallback={
        <Root>
          <ScrollArea.Viewport>
            <Source file={props.selectedFile} />
          </ScrollArea.Viewport>
          <ScrollArea.Corner />
          <ScrollArea.Scrollbar orientation="vertical" />
          <ScrollArea.Scrollbar orientation="horizontal" />
          {props.copyButton}
        </Root>
      }
    >
      <div class="DemoCodeBlockCollapsible">
        <Root closed={collapsed()}>
          <ScrollArea.Viewport
            aria-hidden={collapsed() ? "true" : "false"}
            data-closed={collapsed() ? "" : undefined}
            class="DemoCodeBlockViewport"
          >
            <Source file={props.selectedFile} />
          </ScrollArea.Viewport>
          <Show when={props.collapsibleOpen}>
            <ScrollArea.Corner />
            <ScrollArea.Scrollbar orientation="vertical" />
            <ScrollArea.Scrollbar orientation="horizontal" />
          </Show>
          {props.copyButton}
          <Collapsible.Trigger
            class="DemoCollapseButton"
            data-sticky={props.collapsibleOpen ? "" : undefined}
          >
            <span
              ref={props.collapsibleTriggerRef}
              class="DemoCollapseButtonVisual"
            >
              {props.collapsibleOpen ? "Hide code" : "Show code"}
            </span>
          </Collapsible.Trigger>
        </Root>
      </div>
    </Show>
  )
}
