import type { JSX } from "solid-js"
import clsx from "clsx"

export const MAIN_CONTENT_ID = "main-content"
const HREF = `#${MAIN_CONTENT_ID}`

export function SkipNav(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} class={clsx("SkipNav", props.class)} href={HREF} />
}
