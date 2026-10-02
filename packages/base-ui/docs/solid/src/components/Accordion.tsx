import { createContext, createSignal, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitProps } from '../utils/solid-1-compat';
import { Dynamic } from '@solidjs/web';
import clsx from "clsx"

const ARROW_UP = "ArrowUp"
const ARROW_DOWN = "ArrowDown"
const ARROW_LEFT = "ArrowLeft"
const ARROW_RIGHT = "ArrowRight"

const SUPPORTED_KEYS = new Set([ARROW_UP, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, "Home", "End"])

interface AccordionContextValue {
  getRoot: () => HTMLElement | undefined
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

export function Root(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"])
  let rootRef: HTMLElement | undefined
  return (
    <AccordionContext value={{ getRoot: () => rootRef }}>
      <section
        ref={(el) => (rootRef = el)}
        class={clsx("AccordionRoot", local.class)}
        {...rest}
      />
    </AccordionContext>
  )
}

type TriggerProps = JSX.HTMLAttributes<HTMLElement> & {
  index: number
  id?: string
}

export function Trigger(props: TriggerProps) {
  const [local, rest] = splitProps(props, ["class", "index", "id", "onKeyDown", "onClick", "onMouseDown"])
  const ctx = useContext(AccordionContext)

  const onKeyDown: JSX.EventHandlerUnion<HTMLElement, KeyboardEvent> = (event) => {
    if (!ctx || !SUPPORTED_KEYS.has(event.key)) {
      if (typeof local.onKeyDown === "function") local.onKeyDown(event as never)
      return
    }
    event.preventDefault()
    event.stopPropagation()

    const rootElement = ctx.getRoot()
    if (!rootElement) return

    const triggers = rootElement.querySelectorAll<HTMLElement>("summary")
    const lastIndex = triggers.length - 1
    let nextIndex = -1

    switch (event.key) {
      case ARROW_LEFT:
      case ARROW_UP:
        nextIndex = local.index === 0 ? lastIndex : local.index - 1
        break
      case ARROW_RIGHT:
      case ARROW_DOWN:
        nextIndex = local.index + 1 > lastIndex ? 0 : local.index + 1
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = lastIndex
        break
    }

    if (nextIndex > -1) triggers.item(nextIndex).focus()
    if (typeof local.onKeyDown === "function") local.onKeyDown(event as never)
  }

  const onClick: JSX.EventHandlerUnion<HTMLElement, MouseEvent> = (event) => {
    const selection = window.getSelection()
    if (!selection?.isCollapsed) event.preventDefault()
    if (typeof local.onClick === "function") local.onClick(event as never)
  }

  const onMouseDown: JSX.EventHandlerUnion<HTMLElement, MouseEvent> = (event) => {
    if (!event.defaultPrevented && event.detail > 1) event.preventDefault()
    if (typeof local.onMouseDown === "function") local.onMouseDown(event as never)
  }

  return (
    <summary
      id={local.id}
      class={clsx("AccordionTrigger", local.class)}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onMouseDown={onMouseDown}
      {...rest}
    />
  )
}

type ItemProps = JSX.HTMLAttributes<HTMLDetailsElement> & {
  gaCategory?: string
  gaLabel?: string
  gaParams?: Record<string, string | number | boolean>
}

export function Item(props: ItemProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "gaCategory",
    "gaLabel",
    "gaParams",
    "onToggle",
  ])
  const [open, setOpen] = createSignal(false)

  /* Chrome auto-opens <details> when hash matches <summary> id; Safari/Firefox need manual handling. */
  const handleRef = (element: HTMLDetailsElement | null) => {
    if (!element) return
    const trigger = element.querySelector<HTMLElement>("summary")
    const triggerId = trigger?.getAttribute("id")
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : ""
    if (triggerId && hash && triggerId === hash) setOpen(true)
  }

  return (
    <details
      ref={handleRef}
      open={open() || undefined}
      class={clsx("AccordionItem", local.class)}
      onToggle={(event: ToggleEvent & { currentTarget: HTMLDetailsElement }) => {
        if (typeof local.onToggle === "function") local.onToggle(event as never)
        setOpen(event.currentTarget.open)
      }}
      {...rest}
    />
  )
}

export function Panel(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={clsx("AccordionPanel", local.class)} {...rest} />
}

export function Content(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={clsx("AccordionContent", local.class)} {...rest} />
}

interface ScrollableProps extends JSX.HTMLAttributes<HTMLElement> {
  gradientColor?: string
  tag?: "span" | "div"
}

/** Scroll container with overscroll overlay for overflowing trigger content. */
export function Scrollable(props: ScrollableProps) {
  const [local, rest] = splitProps(props, ["class", "children", "gradientColor", "tag", "style"])
  const tag = () => local.tag ?? "span"
  const style = () => ({
    ...(typeof local.style === "object" && local.style ? local.style : {}),
    "--scrollable-gradient-color": local.gradientColor ?? "var(--color-content)",
  })
  return (
    <Dynamic
      component={tag()}
      class={clsx("AccordionScrollable", local.class)}
      style={style() as JSX.CSSProperties}
      {...rest}
    >
      <Dynamic component={tag()} class="AccordionScrollableInner">
        {local.children}
      </Dynamic>
    </Dynamic>
  )
}

export function HeaderRow(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div aria-hidden="true" class={clsx("AccordionHeaderRow", local.class)} {...rest} />
}

export function HeaderCell(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <div class={clsx("AccordionHeaderCell", local.class)} {...rest}>
      <span class="AccordionHeaderCellInner">{local.children}</span>
    </div>
  )
}
