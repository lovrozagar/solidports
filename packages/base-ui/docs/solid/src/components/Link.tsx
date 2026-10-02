import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import clsx from "clsx"

import { splitProps } from '../utils/solid-1-compat';
import "./Link.css"

interface LinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  withArrow?: boolean
}

function Arrow() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="Icon"
    >
      <path class="LinkArrowCaret" d="M6 12L10 8L6 4" />
      <path class="LinkArrowLine" d="M2 8L13 8" />
    </svg>
  )
}

/** Same link treatment as the React docs: optional arrow, no automatic external icon. */
export function Link(props: LinkProps) {
  const [local, rest] = splitProps(props, ["href", "class", "children", "withArrow"])
  const pathname = () => {
    let href = local.href
    if (href.startsWith("https://base-ui.com/")) {
      href = href.replace("https://base-ui.com/", "/")
    }
    return href
  }
  const path = createMemo(pathname)
  const outsideRouter = createMemo(() => {
    const href = path()
    return (
      href.startsWith("#") ||
      href.startsWith("/r/") ||
      href.endsWith(".md") ||
      href.endsWith(".txt") ||
      href.startsWith("http")
    )
  })
  const content = () => (
    <>
      {local.children}
      {local.withArrow ? <Arrow /> : null}
    </>
  )
  return (
    <>
      {outsideRouter() ? (
        <a {...rest} href={path()} class={clsx("Link", local.class)}>
          {content()}
        </a>
      ) : (
        <a {...rest} href={path()} class={clsx("Link", local.class)}>
          {content()}
        </a>
      )}
    </>
  )
}
