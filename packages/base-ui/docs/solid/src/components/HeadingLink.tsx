import type { JSX } from '@solidjs/web';
import clsx from "clsx"
import { splitProps } from '../utils/solid-1-compat';
import "./HeadingLink.css"

export function HeadingLink(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [local, rest] = splitProps(props, ["class", "id"])
  return (
    <a
      class={clsx("HeadingLink", local.class)}
      href={local.id ? `#${local.id}` : undefined}
      {...rest}
    />
  )
}
