import clsx from "clsx"
import type { ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Menu } from "@solidports/base-ui/menu"
import "./Menu.css"

export const Root = Menu.Root

export const Trigger = Menu.Trigger

export function Popup(
  props: ParentProps<{
    class?: string
    sideOffset?: number
    align?: "start" | "center" | "end"
    alignOffset?: number
  }>,
) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        class="MenuPositioner"
        sideOffset={props.sideOffset ?? 8}
        align={props.align}
        alignOffset={props.alignOffset}
      >
        <Menu.Popup class={clsx("MenuPopup", props.class)}>{props.children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function Item(
  props: ParentProps<{ class?: string; closeOnClick?: boolean; onClick?: () => void }>,
) {
  return (
    <Menu.Item class={clsx("MenuItem", props.class)} closeOnClick={props.closeOnClick} onClick={props.onClick}>
      {props.children}
    </Menu.Item>
  )
}

export function LinkItem(
  props: ParentProps<{
    class?: string
    href: string
    target?: string
    rel?: string
    onClick?: () => void
  }>,
) {
  return (
    <Menu.LinkItem
      class={clsx("MenuItem", props.class)}
      href={props.href}
      target={props.target}
      rel={props.rel}
      onClick={props.onClick}
    >
      {props.children}
    </Menu.LinkItem>
  )
}
