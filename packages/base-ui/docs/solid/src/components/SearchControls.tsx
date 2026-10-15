import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  lazy,
  Loading,
  onSettled,
  untrack,
} from 'solid-js';
import { useSyncExternalStore } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { usePathname } from 'docs/src/adapters/next/navigation';
import { Dialog } from '@solidports/base-ui/dialog';
import { Drawer } from '@solidports/base-ui/drawer';
import { platform } from '@base-ui/utils/platform';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { MagnifyingGlassIcon } from 'docs/src/icons/MagnifyingGlassIcon';
import { loadSearchSitemap } from './Search/searchSitemap';
import { MobileNavContext } from './MobileNavContext';
import './MobileNav.css';
import './SearchTrigger.css';

const SearchDialog = lazy(async () => ({
  default: (await import('./Search/SearchDialog')).SearchDialog,
}));
const MobileNavDrawer = lazy(async () => ({
  default: (await import('./MobileNavDrawer')).MobileNavDrawer,
}));
function preloadSearchSitemap() {
  void loadSearchSitemap().catch(() => undefined);
}
type OpenTarget = 'desktop' | 'mobile' | 'mobile-search';
type DialogTriggerClickEvent = Parameters<
  NonNullable<
    Extract<Dialog.Trigger.Props['onClick'], ((...args: never) => unknown) | null | undefined>
  >
>[0];
type DrawerTriggerClickEvent = Parameters<
  NonNullable<
    Extract<Drawer.Trigger.Props['onClick'], ((...args: never) => unknown) | null | undefined>
  >
>[0];
interface SearchControlsProps {
  desktopTriggerClassName?: string;
  mobileTriggerClassName?: string;
}
export function SearchControls(props: SearchControlsProps) {
  const [desktopHandle] = createSignal(() => untrack(() => Dialog.createHandle()));
  const [mobileHandle] = createSignal(() => untrack(() => Drawer.createHandle()));
  const desktopTriggerId = createUniqueId();
  const mobileTriggerId = createUniqueId();
  const desktopTriggerRef: {
    current: HTMLButtonElement | null;
  } = {
    current: null,
  };
  const mobileTriggerRef: {
    current: HTMLButtonElement | null;
  } = {
    current: null,
  };
  const scrollTopAfterMobileCloseRef = {
    current: false,
  };
  const scrollTopAfterMobileNavigationRef: {
    current: string | null;
  } = {
    current: null,
  };
  const [openTarget, setOpenTarget] = createSignal<OpenTarget | null>(null);
  const preloadTimeout = useTimeout();
  const pathname = usePathname();
  const isCmd = useSyncExternalStore(
    () => () => {},
    () => platform.os.mac,
    () => true,
  );
  const closeMobileNav = () => {
    scrollTopAfterMobileCloseRef.current = false;
    scrollTopAfterMobileNavigationRef.current = null;
    setOpenTarget(null);
  };
  const closeMobileNavAndScrollTop = () => {
    scrollTopAfterMobileCloseRef.current = true;
    scrollTopAfterMobileNavigationRef.current = null;
    setOpenTarget(null);
  };
  const closeMobileNavAndScrollTopAfterNavigation = (nextPathname: string) => {
    scrollTopAfterMobileCloseRef.current = false;
    scrollTopAfterMobileNavigationRef.current = nextPathname;
  };
  const mobileContextValue = createMemo(() => ({
    close: closeMobileNav,
    closeAndScrollTop: closeMobileNavAndScrollTop,
    closeAndScrollTopAfterNavigation: closeMobileNavAndScrollTopAfterNavigation,
  }));
  const handleDesktopTriggerClick = (event: DialogTriggerClickEvent) => {
    event?.preventBaseUIHandler();
    preloadSearchSitemap();
    setOpenTarget('desktop');
  };
  const handleMobileTriggerClick = (event: DrawerTriggerClickEvent) => {
    event?.preventBaseUIHandler();
    preloadSearchSitemap();
    scrollTopAfterMobileCloseRef.current = false;
    setOpenTarget('mobile');
  };
  const handleDesktopOpenChange = (open: boolean) => {
    if (open) {
      setOpenTarget('desktop');
      return;
    }
    setOpenTarget((target) => {
      if (target === 'desktop') {
        return null;
      }
      return target;
    });
  };
  const handleMobileOpenChange = (open: boolean) => {
    if (open) {
      scrollTopAfterMobileCloseRef.current = false;
      setOpenTarget('mobile');
      return;
    }
    setOpenTarget((target) => {
      if (target === 'mobile' || target === 'mobile-search') {
        return null;
      }
      return target;
    });
  };
  const handleMobileOpenChangeComplete = (open: boolean) => {
    if (open || !scrollTopAfterMobileCloseRef.current) {
      return;
    }
    scrollTopAfterMobileCloseRef.current = false;
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };
  createEffect(
    () => [preloadTimeout()],
    () => {
      // Warm the search chunk shortly after mount without competing with initial hydration.
      preloadTimeout().start(250, preloadSearchSitemap);
      return preloadTimeout().clear;
    },
  );
  createEffect(
    () => [pathname()],
    () => {
      if (scrollTopAfterMobileNavigationRef.current !== pathname()) {
        return;
      }
      scrollTopAfterMobileNavigationRef.current = null;
      setOpenTarget(null);
      window.scrollTo({
        top: 0,
        behavior: 'instant',
      });
    },
  );
  onSettled(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        const nextOpenTarget = getShortcutTarget(
          desktopTriggerRef.current,
          mobileTriggerRef.current,
        );
        event.preventDefault();
        event.stopPropagation();
        preloadSearchSitemap();
        setOpenTarget(nextOpenTarget);
      }
    };
    window.addEventListener('keydown', handleKeyDown, {
      capture: true,
    });
    return () =>
      window.removeEventListener('keydown', handleKeyDown, {
        capture: true,
      });
  });
  const desktopOpen = createMemo(() => openTarget() === 'desktop');
  const mobileOpen = createMemo(() => {
    const _openTarget = openTarget();
    return _openTarget === 'mobile' || _openTarget === 'mobile-search';
  });
  const focusMobileSearchOnOpen = createMemo(() => openTarget() === 'mobile-search');
  return (
    <>
      <Dialog.Trigger
        id={desktopTriggerId}
        ref={(element) => {
          desktopTriggerRef.current = element;
        }}
        handle={desktopHandle()}
        class={clsx('SearchTrigger', props.desktopTriggerClassName)}
        onPointerDown={preloadSearchSitemap}
        onClick={handleDesktopTriggerClick}
      >
        Search
        <span class="SearchTriggerShortcut">
          ({isCmd() ? <kbd>⌘</kbd> : <kbd>Ctrl+</kbd>}
          <kbd>k</kbd>)
        </span>
      </Dialog.Trigger>
      <Loading fallback={null}>
        <SearchDialog
          handle={desktopHandle()}
          open={desktopOpen()}
          onOpenChange={handleDesktopOpenChange}
          triggerId={desktopOpen() ? desktopTriggerId : null}
        />
      </Loading>

      <MobileNavContext value={mobileContextValue}>
        <Drawer.Trigger
          id={mobileTriggerId}
          ref={(element) => {
            mobileTriggerRef.current = element;
          }}
          handle={mobileHandle()}
          class={clsx('SearchTrigger', props.mobileTriggerClassName)}
          onPointerDown={preloadSearchSitemap}
          onClick={handleMobileTriggerClick}
        >
          <MagnifyingGlassIcon class="MobileNavTriggerIcon" />
          Navigation
        </Drawer.Trigger>
        <Loading fallback={null}>
          <MobileNavDrawer
            handle={mobileHandle()}
            focusSearchOnOpen={focusMobileSearchOnOpen()}
            open={mobileOpen()}
            onOpenChange={handleMobileOpenChange}
            onOpenChangeComplete={handleMobileOpenChangeComplete}
            triggerId={mobileOpen() ? mobileTriggerId : null}
          />
        </Loading>
      </MobileNavContext>
    </>
  );
}
function getVisibleTarget(element: HTMLElement | null) {
  if (element?.getClientRects().length) {
    return element;
  }
  return null;
}
function getShortcutTarget(
  desktopTrigger: HTMLElement | null,
  mobileTrigger: HTMLElement | null,
): Extract<OpenTarget, 'desktop' | 'mobile-search'> {
  const visibleTarget = getVisibleTarget(desktopTrigger) ?? getVisibleTarget(mobileTrigger);
  return visibleTarget === desktopTrigger ? 'desktop' : 'mobile-search';
}
