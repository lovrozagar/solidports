import { splitProps, type JSX } from "solid-js"
import clsx from "clsx"
import { MarkdownLink } from "./MarkdownLink"

export function Subtitle(
  props: JSX.HTMLAttributes<HTMLParagraphElement> & { skipMarkdownLink?: boolean },
) {
  const [local, rest] = splitProps(props, ["class", "skipMarkdownLink"])
  return (
    <div
      class={clsx(
        "Subtitle flex items-baseline justify-between flex-col md:flex-row",
        local.class,
      )}
    >
      <p {...rest} />
      {!local.skipMarkdownLink && <MarkdownLink />}
    </div>
  )
}
