import { element, place } from 'docs/src/adapters/react';
import { createMemo, omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import NextLink from 'docs/src/adapters/next/link';
import './Link.css';

interface LinkProps extends ReactProps<ComponentProps<typeof NextLink>> {
  withArrow?: boolean;
}
export function Link(props: LinkProps) {
  const rest = omit(props, 'children', 'href', 'class', 'withArrow');
  const _render = createMemo(() => {
    let pathname = typeof props.href === 'string' ? props.href : props.href.pathname!;
    const content = props.withArrow
      ? element(() => (
          <>
            {props.children}
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="Icon"
            >
              <path class="LinkArrowCaret" d="M6 12L10 8L6 4"></path>
              <path class="LinkArrowLine" d="M2 8L13 8"></path>
            </svg>
          </>
        ))
      : props.children;

    // Sometimes link come from component descriptions; in this case, remove the domain
    if (pathname.startsWith('https://base-ui.com/')) {
      pathname = pathname.replace('https://base-ui.com/', '/');
    }
    if (
      pathname.startsWith('#') ||
      pathname.startsWith('/r/') ||
      pathname.endsWith('.md') ||
      pathname.endsWith('.txt')
    ) {
      // Relative URL, but outside the Next.js router
      return (
        <a {...rest} href={pathname} class={clsx('Link', props.class)}>
          {place(content)}
        </a>
      );
    }
    return (
      <NextLink {...rest} href={props.href} class={clsx('Link', props.class)}>
        {place(content)}
      </NextLink>
    );
  });
  return <>{_render()}</>;
}
