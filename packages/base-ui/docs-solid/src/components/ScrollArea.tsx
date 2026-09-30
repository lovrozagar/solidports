import { splitProps, type JSX } from "solid-js"
import { ScrollArea as BaseScrollArea } from "@solidports/base-ui/scroll-area"
import clsx from "clsx"

export const Root = BaseScrollArea.Root

export function Viewport(props: BaseScrollArea.Viewport.Props) {
  const [local, rest] = splitProps(props as JSX.HTMLAttributes<HTMLDivElement>, ["class"])
  return <BaseScrollArea.Viewport class={clsx("ScrollAreaViewport", local.class)} {...(rest as BaseScrollArea.Viewport.Props)} />
}

export function Scrollbar(props: BaseScrollArea.Scrollbar.Props) {
  const [local, rest] = splitProps(props as JSX.HTMLAttributes<HTMLDivElement> & BaseScrollArea.Scrollbar.Props, ["class"])
  return (
    <BaseScrollArea.Scrollbar class={clsx("ScrollAreaScrollbar", local.class)} {...(rest as BaseScrollArea.Scrollbar.Props)}>
      <BaseScrollArea.Thumb class="ScrollAreaThumb" />
    </BaseScrollArea.Scrollbar>
  )
}

export function Corner(props: BaseScrollArea.Corner.Props) {
  const [local, rest] = splitProps(props as JSX.HTMLAttributes<HTMLDivElement>, ["class"])
  return <BaseScrollArea.Corner class={clsx("ScrollAreaCorner", local.class)} {...(rest as BaseScrollArea.Corner.Props)} />
}
