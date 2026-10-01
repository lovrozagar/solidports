import { splitProps, type JSX } from "solid-js"
import clsx from "clsx"
import "./GhostButton.css"

interface GhostButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  layout?: "text" | "icon"
}

export function GhostButton(props: GhostButtonProps) {
  const [local, rest] = splitProps(props, ["class", "layout", "type"])
  const layout = () => local.layout ?? "text"
  return (
    <button
      data-layout={layout()}
      type={local.type ?? "button"}
      class={clsx("GhostButton", local.class)}
      {...rest}
    />
  )
}
