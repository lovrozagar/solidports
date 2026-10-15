import { createMemo, omit, useContext } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import NextLink from 'docs/src/adapters/next/link';
import { usePathname } from 'docs/src/adapters/next/navigation';
import { MobileNavContext } from './MobileNavContext';
import './MobileNav.css';

export function Section(props: ReactProps<ComponentProps<'div'>>) {
  return <div {...props} class={clsx('MobileNavSection', props.class)} />;
}
export function Heading(props: ReactProps<ComponentProps<'div'>>) {
  return <div {...props} class={clsx('MobileNavHeading', props.class)} />;
}
export function List(props: ReactProps<ComponentProps<'ul'>>) {
  return <ul {...props} class={clsx('MobileNavList', props.class)} />;
}
export function Badge(props: ReactProps<ComponentProps<'span'>>) {
  return <span {...props} class={clsx('MobileNavBadge', props.class)} />;
}
interface ItemProps extends ReactProps<ComponentProps<'li'>> {
  active?: boolean;
  href: string;
  rel?: string;
  external?: boolean;
}
export function Item(props: ItemProps) {
  const rest = omit(props, 'active', 'children', 'class', 'external', 'href', 'rel');
  const _useContext = useContext(MobileNavContext);
  const _useContext2 = createMemo(() => {
    const { closeAndScrollTop, closeAndScrollTopAfterNavigation } = _useContext();
    return {
      closeAndScrollTop,
      closeAndScrollTopAfterNavigation,
    };
  });
  const pathname = usePathname();
  const active = createMemo(() => props.active ?? pathname() === props.href);
  const handleClick = (
    event: MouseEvent & {
      currentTarget: HTMLAnchorElement;
      target: Element;
    },
  ) => {
    if (props.href !== window.location.pathname || isModifiedEvent(event)) {
      return;
    }
    event.preventDefault();
    _useContext2().closeAndScrollTop();
  };
  const handleNavigate = () => {
    const nextPathname = new URL(props.href, window.location.href).pathname;
    _useContext2().closeAndScrollTopAfterNavigation(nextPathname);
  };
  const linkProps = createMemo(() => {
    const _active = active();
    return {
      'aria-current': _active ? ('page' as const) : undefined,
      'data-active': _active ? '' : undefined,
      className: 'MobileNavLink',
      href: props.href,
      rel: props.rel,
      onClick: handleClick,
    };
  });
  return (
    <li {...rest} class={props.class}>
      {props.external ? (
        <a {...linkProps()}>{props.children}</a>
      ) : (
        // We handle scroll manually
        <NextLink {...linkProps()} scroll={false} onNavigate={handleNavigate}>
          {props.children}
        </NextLink>
      )}
    </li>
  );
}
function isModifiedEvent(
  event: MouseEvent & {
    currentTarget: HTMLAnchorElement;
    target: Element;
  },
) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}
