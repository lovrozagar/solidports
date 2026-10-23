/*
 * The hand-written Solid floor for NavigationMenu's Item, Icon and Link (D32's sweep): the fewest
 * reactive nodes plain Solid 2 needs for the DOM those parts render. An item is a plain `<li>`; an
 * icon writes its open state from one render effect; a link writes `aria-current` and its active
 * state from one render effect and binds module-level handlers to its record. A hand-written menu
 * knows its links, so a link registers nothing.
 *
 * Cost tests (`navigationMenu.cost.test.tsx`) report each part's nodes against these.
 */
import { createRenderEffect } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';

/** An item: a plain `<li>`. */
export function FloorNavigationMenuItem(props: { children?: JSX.Element }) {
  return <li>{props.children}</li>;
}

/** An icon: `aria-hidden` and its open state from one render effect. */
export function FloorNavigationMenuIcon(props: { open: Accessor<boolean> }) {
  const el = (<span aria-hidden="true">▼</span>) as HTMLSpanElement;
  createRenderEffect(props.open, (open) => {
    if (open) {
      el.setAttribute('data-popup-open', '');
    } else {
      el.removeAttribute('data-popup-open');
    }
  });
  return el;
}

/** What a link's handlers act on: one object per link. */
interface FloorLinkRecord {
  onNavigate: () => void;
}

function linkClick(record: FloorLinkRecord) {
  record.onNavigate();
}

export interface FloorNavigationMenuLinkProps {
  href: string;
  active: Accessor<boolean>;
  onNavigate: () => void;
  children?: JSX.Element;
}

/** A link: `aria-current` and `data-active` from one render effect. */
export function FloorNavigationMenuLink(props: FloorNavigationMenuLinkProps) {
  const record: FloorLinkRecord = { onNavigate: props.onNavigate };
  const el = (
    <a href={props.href} onClick={[linkClick, record]}>
      {props.children}
    </a>
  ) as HTMLAnchorElement;
  createRenderEffect(props.active, (active) => {
    if (active) {
      el.setAttribute('aria-current', 'page');
      el.setAttribute('data-active', '');
    } else {
      el.removeAttribute('aria-current');
      el.removeAttribute('data-active');
    }
  });
  return el;
}
