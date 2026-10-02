import { createEffect, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import clsx from "clsx"
import { useLocation } from "@solidjs/router"
import { ScrollArea } from "@solidports/base-ui/scroll-area"
import scrollIntoView from "scroll-into-view-if-needed"

interface ScrollActionLike {
  top: number
  left: number
  el: Element
}
import { HEADER_HEIGHT_DESKTOP } from "./Header"

import { splitProps } from '../utils/solid-1-compat';
import "./SideNav.css"

export function Root(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <nav aria-label="Main navigation" {...rest} class={clsx("SideNavRoot", local.class)}>
      <ScrollArea.Root>
        <ScrollArea.Viewport data-side-nav-viewport class="SideNavViewport">
          {local.children}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar class="SideNavScrollbar" orientation="vertical">
          <ScrollArea.Thumb class="SideNavScrollbarThumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </nav>
  )
}

export function Section(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div {...rest} class={clsx("SideNavSection", local.class)} />
}

export function Heading(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div {...rest} class={clsx("SideNavHeading", local.class)} />
}

export function Separator(props: JSX.HTMLAttributes<HTMLHRElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <hr {...rest} class={clsx("SideNavSeparator", local.class)} />
}

export function List(props: JSX.HTMLAttributes<HTMLUListElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <ul {...rest} class={clsx("SideNavList", local.class)} />
}

export function Badge(props: JSX.HTMLAttributes<HTMLSpanElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <span {...rest} class={clsx("SideNavBadge", local.class)} />
}

interface ItemProps extends JSX.LiHTMLAttributes<HTMLLIElement> {
  active?: boolean
  href: string
  isNew?: boolean
  external?: boolean
  icon?: JSX.Element | ((props: JSX.SvgSVGAttributes<SVGSVGElement>) => JSX.Element)
}

const SCROLL_MARGIN = 48

export function Item(props: ItemProps) {
  const [local, rest] = splitProps(props, ["children", "class", "href", "external", "icon"])
  let ref: HTMLLIElement | undefined
  const location = useLocation()
  const active = () => location.pathname === local.href
  let rem = 16

  onSettled(() => {
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  })

  createEffect(
    () => active(),
    (isActive) => {
      if (!ref || !isActive) {
        return
      }
      const scrollMargin = (SCROLL_MARGIN * rem) / 16
      const headerHeight = (HEADER_HEIGHT_DESKTOP * rem) / 16
      const viewport = document.querySelector("[data-side-nav-viewport]")

      if (!viewport) {
        return
      }

      scrollIntoView(ref, {
        block: "nearest",
        scrollMode: "if-needed",
        boundary: (parent: Element) => viewport.contains(parent),
        behavior: (actions: ScrollActionLike[]) => {
          actions.forEach(({ top }) => {
            const dir = viewport.scrollTop > top ? -1 : 1
            const offset = Math.max(0, headerHeight - Math.max(0, window.scrollY))
            viewport.scrollTop = top + offset + scrollMargin * dir
          })
        },
      })
    },
  )

  const commonAttrs = () =>
    active()
      ? {
          "aria-current": "true" as const,
          "data-active": "" as const,
          onClick: () => {
            /* Scroll to top smoothly when clicking on the currently active item. */
            window.scrollTo({ top: 0, behavior: "smooth" })
          },
        }
      : {}

  return (
    <li ref={ref} {...rest} class={clsx("SideNavItem", local.class)}>
      {local.external ? (
        <a class="SideNavLink" href={local.href} {...commonAttrs()}>
          {local.icon ? (
            <div class="SideNavLinkIconContainer">
              {typeof local.icon === "function" ? local.icon({}) : local.icon}
              {local.children}
            </div>
          ) : (
            local.children
          )}
        </a>
      ) : (
        <a class="SideNavLink" href={local.href} noscroll={active()} {...commonAttrs()}>
          {local.icon ? (
            <div class="SideNavLinkIconContainer">
              {typeof local.icon === "function" ? local.icon({}) : local.icon}
              {local.children}
            </div>
          ) : (
            local.children
          )}
        </a>
      )}
    </li>
  )
}
