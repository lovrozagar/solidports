import { createSignal, onCleanup, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Dialog } from "@solidports/base-ui/dialog"
import clsx from "clsx"
import { isMac } from "../../utils/detect-browser"
import { MagnifyingGlassIcon } from "../../icons/MagnifyingGlassIcon"
import "../SearchTrigger.css"
import "../MobileNav.css"
import "./SearchBar.css"

interface SearchBarProps {
  enableKeyboardShortcut?: boolean
  containedScroll?: boolean
  desktopTriggerClass?: string
  mobileTriggerClass?: string
}

/** Offline Search stub. Ctrl/Cmd+K opens a dialog with an input + empty result state.
    Full Algolia/DocSearch integration deferred to Wave V∞ (see spec Decision 2). */
export function SearchBar(props: SearchBarProps) {
  const [open, setOpen] = createSignal(false)
  let inputRef: HTMLInputElement | undefined

  function handleOpen() {
    setOpen(true)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
  }

  onSettled(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (!props.enableKeyboardShortcut) return

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        event.stopPropagation()
        if (!open()) handleOpen()
      }
    }
    window.addEventListener("keydown", onKeyDown, { capture: true })
    _c.push(() => window.removeEventListener("keydown", onKeyDown, { capture: true }))
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
})

  const showCmd = () => props.enableKeyboardShortcut && isMac

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        class={clsx("SearchTrigger", props.desktopTriggerClass)}
      >
        Search
        <span class="SearchTriggerShortcut">
          ({showCmd() ? <kbd>⌘</kbd> : <kbd>Ctrl+</kbd>}
          <kbd>k</kbd>)
        </span>
      </button>
      <button
        type="button"
        onClick={handleOpen}
        class={clsx("SearchTrigger", props.mobileTriggerClass)}
      >
        <MagnifyingGlassIcon class="MobileNavTriggerIcon" />
        Navigation
      </button>

      <Dialog.Root open={open()} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop class="fixed inset-0 min-h-dvh bg-black opacity-20 transition-all duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:opacity-70" />
          <Dialog.Viewport class="group/dialog fixed inset-0 flex items-start justify-center overflow-hidden pt-18">
            <Dialog.Popup
              initialFocus={inputRef}
              data-open={open()}
              class="relative flex rounded-2xl min-h-0 max-h-[min(29.5rem,calc(100vh-6rem))] w-[min(34rem,calc(100vw-2rem))] flex-col overflow-hidden bg-white text-gray-900 outline-1 outline-black/4 shadow-[0_.5px_1px_hsl(0_0%_0%/12%),0_1px_3px_-1px_hsl(0_0%_0%/4%)] transition-all duration-150 data-ending-style:scale-90 data-ending-style:opacity-0 data-ending-style:-translate-y-4 data-starting-style:scale-90 data-starting-style:opacity-0 data-starting-style:-translate-y-4 dark:bg-[oklch(20%_0.5%_264deg)] dark:outline-white/25"
            >
              <div class="shrink-0 border-b border-gray-100 pt-2 px-2 pb-1.5">
                <div class="flex items-center gap-2 h-8 rounded-lg bg-popover px-3">
                  <SearchIcon />
                  <input
                    id="search-input"
                    ref={(el) => (inputRef = el)}
                    placeholder="Search"
                    class="w-full border-0 bg-transparent text-base tracking-[0.016em] font-normal text-gray-900 placeholder:text-gray-500 focus:outline-none"
                  />
                </div>
              </div>
              <div class="flex min-h-0 flex-1">
                <div class="px-3 py-6 text-center text-[0.9375rem] tracking-[0.016em] font-normal text-gray-600">
                  Search index pending. Full-text search ships in a later wave.
                </div>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function SearchIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      class="h-4 w-4 shrink-0 text-gray-500"
    >
      <circle cx="7" cy="7" r="5" stroke="currentcolor" stroke-width="1.5" />
      <path d="M11 11L14 14" stroke="currentcolor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  )
}
