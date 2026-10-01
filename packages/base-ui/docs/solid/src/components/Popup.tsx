import { splitProps, type JSX } from "solid-js"
import clsx from "clsx"

export function Popup(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={clsx("Popup", local.class)} {...rest} />
}
