import { Show, splitProps, type JSX } from "solid-js"
import clsx from "clsx"
import { MarkdownLink } from "./MarkdownLink"
import { ViewSourceLink } from "./ViewSourceLink"
import "./Subtitle.css"

export function Subtitle(
  props: JSX.HTMLAttributes<HTMLParagraphElement> & { skipLinks?: boolean },
) {
  const [local, rest] = splitProps(props, ["class", "skipLinks"])
  return (
    <div class={clsx("Subtitle", local.class)}>
      <p {...rest} />
      <Show when={!local.skipLinks}>
        <div class="SubtitleLinks">
          <MarkdownLink />
          <ViewSourceLink />
        </div>
      </Show>
    </div>
  )
}
