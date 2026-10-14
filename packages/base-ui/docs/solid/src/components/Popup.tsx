import type { JSX } from '@solidjs/web';
import clsx from "clsx"
import { splitProps } from '../utils/solid-1-compat';

export function Popup(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={clsx("Popup", local.class)} {...rest} />
}
