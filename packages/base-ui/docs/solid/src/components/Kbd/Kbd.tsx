import { splitProps, type JSX } from "solid-js"
import clsx from "clsx"
import "./Kbd.css"

export function Kbd(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <kbd class={clsx("Kbd", local.class)} {...rest} />
}
