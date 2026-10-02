import type { JSX } from '@solidjs/web';
import { splitProps } from '../../utils/solid-1-compat';
import clsx from "clsx"
import "./Kbd.css"

export function Kbd(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <kbd class={clsx("Kbd", local.class)} {...rest} />
}
