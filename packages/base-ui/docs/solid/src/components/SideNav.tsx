import { createEffect, createMemo, omit, onSettled } from 'solid-js';
import { Dynamic } from '@solidjs/web';
import { place } from 'docs/src/adapters/react';
import type { ComponentProps, JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import NextLink from 'docs/src/adapters/next/link';
import { usePathname } from 'docs/src/adapters/next/navigation';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import scrollIntoView from 'scroll-into-view-if-needed';
import { HEADER_HEIGHT_DESKTOP } from './Header';
import './SideNav.css';

export function Root(props: ReactProps<ComponentProps<'div'>>) {
  return (
    <nav aria-label="Main navigation" {...props} class={clsx('SideNavRoot', props.class)}>
      <ScrollArea.Root>
        <ScrollArea.Viewport data-side-nav-viewport class="SideNavViewport">
          {props.children}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar class="SideNavScrollbar" orientation="vertical">
          <ScrollArea.Thumb class="SideNavScrollbarThumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </nav>
  );
}
export function Section(props: ReactProps<ComponentProps<'div'>>) {
  return <div {...props} class={clsx('SideNavSection', props.class)} />;
}
export function Heading(props: ReactProps<ComponentProps<'div'>>) {
  return <div {...props} class={clsx('SideNavHeading', props.class)} />;
}
export function Separator(props: ReactProps<ComponentProps<'hr'>>) {
  return <hr {...props} class={clsx('SideNavSeparator', props.class)} />;
}
export function List(props: ReactProps<ComponentProps<'ul'>>) {
  return <ul {...props} class={clsx('SideNavList', props.class)} />;
}
export function Badge(props: ReactProps<ComponentProps<'span'>>) {
  return <span {...props} class={clsx('SideNavBadge', props.class)} />;
}
interface ItemProps extends ReactProps<ComponentProps<'li'>> {
  active?: boolean;
  href: string;
  isNew?: boolean;
  external?: boolean;
  icon?: JSX.Element;
}
const SCROLL_MARGIN = 48;
export function Item(props: ItemProps) {
  const other = omit(props, 'children', 'class', 'href', 'external', 'icon');
  const ref: {
    current: HTMLLIElement | null;
  } = {
    current: null,
  };
  const pathname = usePathname();
  const exactActive = createMemo(() => pathname() === props.href);
  const active = createMemo(() => exactActive() || pathname().startsWith(`${props.href}/`));
  const rem = {
    current: 16,
  };
  onSettled(() => {
    rem.current = parseFloat(getComputedStyle(document.documentElement).fontSize);
  });
  createEffect(
    () => [active()],
    () => {
      if (ref.current && active()) {
        const scrollMargin = (SCROLL_MARGIN * rem.current) / 16;
        const headerHeight = (HEADER_HEIGHT_DESKTOP * rem.current) / 16;
        const viewport = document.querySelector('[data-side-nav-viewport]');
        if (!viewport) {
          return;
        }
        scrollIntoView(ref.current, {
          block: 'nearest',
          scrollMode: 'if-needed',
          boundary: (parent) => viewport.contains(parent),
          behavior: (actions) => {
            actions.forEach(({ top }) => {
              const dir = viewport.scrollTop > top ? -1 : 1;
              const offset = Math.max(0, headerHeight - Math.max(0, window.scrollY));
              viewport.scrollTop = top + offset + scrollMargin * dir;
            });
          },
        });
      }
    },
  );
  const LinkComponent = createMemo(() => (props.external ? 'a' : NextLink));
  const ariaCurrent = createMemo(() => (exactActive() ? 'page' : 'location'));
  return (
    <li
      ref={(element) => {
        ref.current = element;
      }}
      {...other}
      class={clsx('SideNavItem', props.class)}
    >
      <Dynamic
        component={LinkComponent()}
        class="SideNavLink"
        href={props.href}
        scroll={props.external ? undefined : !exactActive()}
        data-active={active() || undefined}
        aria-current={active() ? ariaCurrent() : undefined}
        {...(exactActive()
          ? {
              onClick: () => {
                // Scroll to top smoothly when clicking on the currently active item
                window.scrollTo({
                  top: 0,
                  behavior: 'smooth',
                });
              },
            }
          : {})}
      >
        {props.icon ? (
          <div class="SideNavLinkIconContainer">
            {place(props.icon)}
            {props.children}
          </div>
        ) : (
          props.children
        )}
      </Dynamic>
    </li>
  );
}
