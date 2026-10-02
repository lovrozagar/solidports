import type { JSX } from '@solidjs/web';
import { splitProps } from '../utils/solid-1-compat';
import clsx from "clsx"

export function Popup(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={clsx("Popup", local.class)} {...rest} />
}
