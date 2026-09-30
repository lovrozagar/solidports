import { splitProps, type JSX } from "solid-js"
import { A } from "@solidjs/router"
import clsx from "clsx"
import { ExternalLinkIcon } from "../icons/ExternalLinkIcon"

interface LinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  skipExternalIcon?: boolean
}

/** Anchor that auto-detects external URLs and renders external icon. */
export function Link(props: LinkProps) {
  const [local, rest] = splitProps(props, ["href", "class", "skipExternalIcon", "children"])
  /* base-ui.com links reach us through the upstream MDX — rewrite to relative. */
  const pathname = () => {
    let href = local.href
    if (href.startsWith("https://base-ui.com/")) {
      href = href.replace("https://base-ui.com/", "/")
    }
    return href
  }

  return (
    <>
      {(() => {
        const path = pathname()
        if (path.startsWith("http")) {
          return (
            <a
              target="_blank"
              rel="noopener"
              {...rest}
              href={path}
              class={clsx("Link mr-[0.125em] inline-flex items-center gap-[0.25em]", local.class)}
            >
              {local.children}
              {!local.skipExternalIcon && <ExternalLinkIcon />}
            </a>
          )
        }
        if (path.endsWith(".md") || path.endsWith(".txt")) {
          return <a {...rest} href={path} class={clsx("Link", local.class)}>{local.children}</a>
        }
        return (
          <A {...rest} href={path} class={clsx("Link", local.class)}>
            {local.children}
          </A>
        )
      })()}
    </>
  )
}
