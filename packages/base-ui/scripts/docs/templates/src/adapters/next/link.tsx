// `next/link` for the Solid docs. The router handles plain anchors (it intercepts same-origin
// clicks), so a link is an `<a>` with Next's options as the router's link attributes.
import { createMemo, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';

type UrlObject = {
  pathname?: string | null;
  query?: Record<string, string | number | boolean | ReadonlyArray<string> | null | undefined>;
  hash?: string | null;
};

export interface LinkProps extends Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string | UrlObject;
  prefetch?: boolean | 'auto' | null;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  locale?: string | false;
}

/** The URL a `next/link` `href` names. */
export function formatHref(href: LinkProps['href']): string {
  if (typeof href === 'string') {
    return href;
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item != null) {
        search.append(key, String(item));
      }
    }
  }
  const query = search.toString();
  const hash = href.hash ? `#${href.hash.replace(/^#/, '')}` : '';
  return `${href.pathname ?? ''}${query ? `?${query}` : ''}${hash}`;
}

export default function Link(props: LinkProps) {
  const rest = omit(props, 'href', 'prefetch', 'replace', 'scroll', 'shallow', 'locale');
  const href = createMemo(() => formatHref(props.href));
  // The router's link attributes: `replace`, `noscroll`, and `preload="false"`.
  const routerAttributes = createMemo(() => ({
    replace: props.replace ? '' : undefined,
    noscroll: props.scroll === false ? '' : undefined,
    preload: props.prefetch === false ? 'false' : undefined,
  }));
  return <a {...routerAttributes()} {...rest} href={href()} />;
}
