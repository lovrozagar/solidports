import { createContext, createSignal, onMount, splitProps, useContext, type JSX, type ParentProps } from "solid-js"
import clsx from "clsx"
import { A } from "@solidjs/router"
import { Dialog } from "@solidports/base-ui/dialog"
import { HEADER_HEIGHT } from "./Header"

const MobileNavStateCallback = createContext<(open: boolean) => void>(() => undefined)

export function Root(props: Dialog.Root.Props) {
  const [open, setOpen] = createSignal(false)

  return (
    <MobileNavStateCallback.Provider value={setOpen}>
      <Dialog.Root open={open()} onOpenChange={setOpen} {...props} />
    </MobileNavStateCallback.Provider>
  )
}

export const Trigger = Dialog.Trigger

export function Backdrop(props: Dialog.Backdrop.Props) {
  const [local, rest] = splitProps(props, ["class"])
  return <Dialog.Backdrop {...rest} class={clsx("MobileNavBackdrop", local.class)} />
}

export const Portal = Dialog.Portal

export function Popup(props: Dialog.Popup.Props) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <Dialog.Popup {...rest} class={clsx("MobileNavPopup", local.class)}>
      <PopupImpl>{local.children}</PopupImpl>
    </Dialog.Popup>
  )
}

function PopupImpl(props: ParentProps) {
  const setOpen = useContext(MobileNavStateCallback)
  let rem = 16

  onMount(() => {
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  })

  return (
    <>
      <div class="MobileNavBottomOverscroll" />
      <div
        class="MobileNavViewport"
        onScroll={(event) => {
          const viewport = event.currentTarget
          if (viewport.scrollTop > (HEADER_HEIGHT * rem) / 16) {
            viewport.setAttribute("data-clipped", "")
          } else {
            viewport.removeAttribute("data-clipped")
          }
        }}
        onTouchStart={(event) => {
          const viewport = event.currentTarget

          /* Consider flicks from scroll top only (iOS does the same with its sheets) */
          if (viewport.scrollTop <= 0) {
            viewport.addEventListener(
              "touchend",
              function handleTouchEnd() {
                if (viewport.scrollTop < -32) {
                  const y = viewport.scrollTop

                  viewport.addEventListener(
                    "scroll",
                    function handleNextScroll() {
                      if (viewport.scrollTop < y) {
                        viewport.style.translate = `0px -${y}px`
                        viewport.style.transform = `400ms`
                        setOpen(false)
                      } else if (viewport.scrollTop === y) {
                        viewport.addEventListener("scroll", handleNextScroll, { once: true })
                      }
                    },
                    { once: true },
                  )
                }
              },
              { once: true },
            )
          }
        }}
      >
        <div class="MobileNavViewportInner">
          {/* Area behind the panel closes on tap but also scrolls the viewport. */}
          <Dialog.Close
            class="MobileNavBackdropTapArea"
            tabIndex={-1}
            nativeButton={false}
            render={(divProps) => <div {...divProps} />}
          />

          <nav class="MobileNavPanel">
            {/* Reverse order: close button at end of DOM, at sticky top visually. */}
            <div class="flex flex-col-reverse">
              <div>{props.children}</div>
              <div class="MobileNavCloseContainer">
                <Dialog.Close aria-label="Close the navigation" class="MobileNavClose">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0.75 0.75L6 6M11.25 11.25L6 6M6 6L0.75 11.25M6 6L11.25 0.75"
                      stroke="currentcolor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </Dialog.Close>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </>
  )
}

export function Section(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div {...rest} class={clsx("MobileNavSection", local.class)} />
}

export function Heading(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <div {...rest} class={clsx("MobileNavHeading", local.class)}>
      <div class="MobileNavHeadingInner">{local.children}</div>
    </div>
  )
}

export function List(props: JSX.HTMLAttributes<HTMLUListElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <ul {...rest} class={clsx("MobileNavList", local.class)} />
}

export function Badge(props: JSX.HTMLAttributes<HTMLSpanElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <span {...rest} class={clsx("MobileNavBadge", local.class)} />
}

interface ItemProps extends JSX.LiHTMLAttributes<HTMLLIElement> {
  active?: boolean
  href: string
  rel?: string
  external?: boolean
}

export function Item(props: ItemProps) {
  const [local, rest] = splitProps(props, ["href", "external", "class", "active", "rel", "children"])
  const setOpen = useContext(MobileNavStateCallback)

  return (
    <li {...rest} class={clsx("MobileNavItem", local.class)}>
      {local.external ? (
        <a
          aria-current={local.active ? "page" : undefined}
          class="MobileNavLink"
          href={local.href}
          rel={local.rel}
          onClick={() => {
            handleItemClick(local.href, setOpen)
          }}
        >
          {local.children}
        </a>
      ) : (
        <A
          aria-current={local.active ? "page" : undefined}
          class="MobileNavLink"
          href={local.href}
          noScroll
          onClick={() => {
            handleItemClick(local.href, setOpen)
          }}
        >
          {local.children}
        </A>
      )}
    </li>
  )
}

function handleItemClick(href: string, setOpen: (v: boolean) => void) {
  if (href === window.location.pathname) {
    setOpen(false)
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }, 500)
  } else {
    onUrlChange(() => {
      setOpen(false)
      window.scrollTo({ top: 0, behavior: "instant" })
    })
  }
}

function onUrlChange(callback: () => void) {
  const initialUrl = window.location.href

  function rafRecursively() {
    requestAnimationFrame(() => {
      if (initialUrl === window.location.href) {
        rafRecursively()
      } else {
        callback()
      }
    })
  }

  rafRecursively()
}
