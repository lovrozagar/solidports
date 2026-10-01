import {
  onMount,
  onCleanup,
  splitProps,
  type JSX,
  type ParentProps,
} from "solid-js"
import clsx from "clsx"
import "./QuickNav.css"

export function Container(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={clsx("QuickNavContainer", local.class)} {...rest} />
}

export function Root(props: JSX.HTMLAttributes<HTMLElement> & ParentProps) {
  const [local, rest] = splitProps(props, ["class", "children"])
  let ref: HTMLElement | undefined

  onMount(() => {
    if (!ref) return
    const cleanup = attachStickyBehavior(ref)
    onCleanup(cleanup)
  })

  return (
    <nav
      aria-label="On this page"
      ref={(el) => (ref = el)}
      class={clsx("QuickNavRoot", local.class)}
      {...rest}
    >
      <div class="QuickNavInner">{local.children}</div>
    </nav>
  )
}

/* Nav height > viewport? Push nav based on scroll direction so it sticks to top
   or bottom as if physically constrained by the viewport. Direct port of upstream. */
function attachStickyBehavior(root: HTMLElement) {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const stickyTopThreshold = 2.25 * rem

  let top = 0
  let bottom = 0
  let prevScrollY = window.scrollY
  let resizeObserver: ResizeObserver | undefined
  let state: "Scrollable" | "StickyTop" | "StickyBottom" = "StickyTop"
  let raf = 0

  const cssTop = parseFloat(getComputedStyle(root).top)

  let cachedPositions: {
    staticTop: number
    absoluteTop: number
    absoluteBottom: number
  } | null = null

  function getCachedPositions() {
    if (cachedPositions === null) cachedPositions = getNaturalPositions()
    return cachedPositions
  }

  function getNaturalPositions() {
    const initialStyles = {
      top: root.style.top,
      bottom: root.style.bottom,
      marginTop: root.style.marginTop,
      marginBottom: root.style.marginBottom,
    }

    root.style.top = "0px"
    root.style.bottom = ""
    root.style.marginTop = ""
    root.style.marginBottom = ""

    root.style.position = "static"
    const staticTop = window.scrollY + Math.round(root.getBoundingClientRect().y)
    root.style.marginTop = "0px"
    root.style.position = "absolute"
    const absoluteTop = window.scrollY + Math.round(root.getBoundingClientRect().y)

    root.style.position = "absolute"
    root.style.top = "auto"
    root.style.bottom = "0"
    const rect = root.getBoundingClientRect()
    const absoluteBottom = window.scrollY + Math.round(rect.bottom)

    root.style.position = ""
    root.style.top = initialStyles.top
    root.style.bottom = initialStyles.bottom
    root.style.marginTop = initialStyles.marginTop
    root.style.marginBottom = initialStyles.marginBottom
    if (root.style.length === 0) root.removeAttribute("style")

    return { absoluteTop, staticTop, absoluteBottom }
  }

  function setHeightProperty() {
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(([entry]) => {
        const [{ blockSize }] = entry.borderBoxSize
        root.style.setProperty("--height", `${blockSize}px`)
      })
      resizeObserver.observe(root)
    }
  }

  function stickToTop() {
    state = "StickyTop"
    root.style.top = ""
    root.style.bottom = ""
    root.style.marginTop = ""
    root.style.marginBottom = ""
  }

  function stickToBottom() {
    state = "StickyBottom"
    setHeightProperty()
    root.style.top = `min(var(--top), 100dvh - var(--height))`
    root.style.bottom = ""
    root.style.marginTop = ""
    root.style.marginBottom = ""
  }

  function unstick(newTop: number, newBottom: number) {
    state = "Scrollable"
    const { absoluteTop, absoluteBottom, staticTop } = getCachedPositions()
    const marginTop = Math.max(staticTop - absoluteTop, window.scrollY + newTop - absoluteTop)
    const marginBottom = Math.max(0, absoluteBottom - window.scrollY - newBottom)

    if (marginTop < marginBottom) {
      root.style.top = "auto"
      root.style.bottom = "0"
      root.style.marginTop = marginTop ? `${marginTop}px` : ""
      root.style.marginBottom = ""
    } else {
      root.style.top = ""
      root.style.bottom = ""
      root.style.marginTop = ""
      root.style.marginBottom = marginBottom ? `${marginBottom}px` : ""
    }
  }

  function handleUpdate() {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const isScrollLocked = document.documentElement.hasAttribute("data-base-ui-scroll-locked")
      if (isScrollLocked) return

      const delta = window.scrollY - prevScrollY
      prevScrollY = window.scrollY

      const rect = root.getBoundingClientRect()
      top = rect.top
      bottom = rect.bottom

      if ((delta > 0 && state === "StickyBottom") || (delta < 0 && state === "StickyTop")) return

      if (rect.height + cssTop <= window.innerHeight) {
        if (state !== "StickyTop") stickToTop()
        return
      }

      if (state === "StickyTop") {
        const clippedAtBottom = bottom - window.innerHeight
        if (clippedAtBottom - top > stickyTopThreshold) {
          if (delta >= clippedAtBottom) {
            stickToBottom()
          } else if (delta > 0 && !isOverscrolling()) {
            unstick(Math.round(top) - delta, Math.round(bottom) - delta)
          }
        }
        return
      }

      if (state === "StickyBottom") {
        if (delta <= top) {
          stickToTop()
        } else if (delta < 0 && !isOverscrolling()) {
          unstick(Math.round(top) - delta, Math.round(bottom) - delta)
        }
        return
      }

      if (state === "Scrollable" && delta < 0 && top - delta >= cssTop) {
        stickToTop()
        return
      }

      if (state === "Scrollable" && delta >= 0 && bottom - delta <= window.innerHeight) {
        stickToBottom()
      }
    })
  }

  type IdleCb = (cb: () => void) => number
  type IdleCancel = (id: number) => void
  const requestIdleCallback =
    ((window as unknown as { requestIdleCallback?: IdleCb }).requestIdleCallback ??
      window.setTimeout) as IdleCb
  const cancelIdleCallback =
    ((window as unknown as { cancelIdleCallback?: IdleCancel }).cancelIdleCallback ??
      window.clearTimeout) as IdleCancel

  let callbackId = 0
  function handleResize() {
    cancelIdleCallback(callbackId)
    callbackId = requestIdleCallback(() => {
      cachedPositions = getNaturalPositions()
      handleUpdate()
    })
  }

  let hash = window.location.hash
  let pathname = window.location.pathname
  function handlePopState() {
    if (hash !== window.location.hash && pathname === window.location.pathname) {
      window.removeEventListener("scroll", handleUpdate)
      requestAnimationFrame(() => {
        if (state === "Scrollable") {
          unstick(Math.min(cssTop, top), Math.max(window.innerHeight, bottom))
        }
        prevScrollY = window.scrollY
        window.addEventListener("scroll", handleUpdate)
      })
    }
    hash = window.location.hash
    pathname = window.location.pathname
  }

  requestIdleCallback(getCachedPositions)
  requestIdleCallback(handleUpdate)
  window.addEventListener("scroll", handleUpdate)
  window.addEventListener("resize", handleResize)
  window.addEventListener("popstate", handlePopState)

  return () => {
    resizeObserver?.disconnect()
    window.removeEventListener("scroll", handleUpdate)
    window.removeEventListener("resize", handleResize)
    window.removeEventListener("popstate", handlePopState)
  }
}

function isOverscrolling() {
  return (
    window.scrollY < 0 ||
    window.scrollY + window.innerHeight > document.documentElement.scrollHeight
  )
}

export function Title(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <header class={clsx("bui-sr-only", local.class)} {...rest} />
}

export function List(props: JSX.HTMLAttributes<HTMLUListElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <ul class={clsx("QuickNavList", local.class)} {...rest} />
}

export function Item(props: JSX.HTMLAttributes<HTMLLIElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <li class={clsx("QuickNavItem", local.class)} {...rest} />
}

export function Link(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <a class={clsx("QuickNavLink", local.class)} {...rest} />
}
