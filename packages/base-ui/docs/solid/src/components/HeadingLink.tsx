import { splitProps, type JSX } from "solid-js"
import clsx from "clsx"
import "./HeadingLink.css"

export function HeadingLink(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement> & { id?: string }) {
  const [local, rest] = splitProps(props, ["class", "id"])
  return (
    <a
      class={clsx("HeadingLink", local.class)}
      href={local.id ? `#${local.id}` : undefined}
      {...rest}
    />
  )
}
