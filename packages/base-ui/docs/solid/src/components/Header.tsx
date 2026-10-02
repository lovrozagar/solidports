import { Logo } from "./Logo"
import { SkipNav } from "./SkipNav"
import { Search } from "./Search"
import "./Header.css"

export const titleMap: Record<string, string> = {
  "About Base\xa0UI": "About",
}

export const HEADER_HEIGHT = 64
export const HEADER_HEIGHT_DESKTOP = 64

export function Header() {
  return (
    <header class="Header">
      <div class="HeaderInner">
        <SkipNav>Skip to contents</SkipNav>
        <a href="/" class="HeaderLogoLink" aria-label="Go to the homepage">
          <Logo aria-label="Base UI" />
        </a>
        <div class="HeaderSearch">
          <Search
            containedScroll
            enableKeyboardShortcut
            desktopTriggerClass="HeaderSearchDesktopTrigger"
            mobileTriggerClass="HeaderSearchMobileTrigger"
          />
        </div>
      </div>
    </header>
  )
}
