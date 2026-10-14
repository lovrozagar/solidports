import type { JSX } from '@solidjs/web';
import clsx from "clsx"
import { splitProps } from '../utils/solid-1-compat';

export function Code(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <code class={clsx("Code", local.class)} {...rest} />
}
