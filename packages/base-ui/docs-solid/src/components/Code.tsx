import { splitProps, type JSX } from "solid-js"
import clsx from "clsx"

export function Code(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <code class={clsx("Code", local.class)} {...rest} />
}
