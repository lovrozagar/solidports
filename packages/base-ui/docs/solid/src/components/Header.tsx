import NextLink from 'docs/src/adapters/next/link';
import { Logo } from './Logo';
import { SearchControls } from './SearchControls';
import { SkipNav } from './SkipNav';
import './Header.css';

export const HEADER_HEIGHT_DESKTOP = 64;
export function Header() {
  return (
    <header class="Header">
      <div class="HeaderInner">
        <SkipNav>Skip to contents</SkipNav>
        <NextLink href="/" class="HeaderLogoLink" aria-label="Go to the homepage">
          <Logo aria-label="Base UI" />
        </NextLink>
        <div class="HeaderSearch">
          <SearchControls
            desktopTriggerClassName="HeaderSearchDesktopTrigger"
            mobileTriggerClassName="HeaderSearchMobileTrigger"
          />
        </div>
      </div>
    </header>
  );
}
