import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { usePathname } from 'docs/src/adapters/next/navigation';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import { useGoogleAnalytics } from 'docs/src/blocks/GoogleAnalyticsProvider';
import './QuickNav.css';

export function Container(props: ReactProps<ComponentProps<'div'>>) {
  const rest = omit(props, 'class');
  return <div class={clsx('QuickNavContainer', props.class)} {...rest} />;
}
export function Content(props: ReactProps<ComponentProps<'div'>>) {
  const rest = omit(props, 'class');
  return <div class={clsx('QuickNavContent', props.class)} {...rest} />;
}
export function Root(props: ReactProps<ComponentProps<'div'>>) {
  const rest = omit(props, 'children', 'class');
  return (
    <nav aria-label="On this page" class={clsx('QuickNavRoot', props.class)} {...rest}>
      <div class="QuickNavInner">
        <ScrollArea.Root>
          <ScrollArea.Viewport class="QuickNavViewport">{props.children}</ScrollArea.Viewport>
          <ScrollArea.Scrollbar class="QuickNavScrollbar" orientation="vertical">
            <ScrollArea.Thumb class="QuickNavScrollbarThumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>
    </nav>
  );
}
export function Title(props: ReactProps<ComponentProps<'header'>>) {
  const rest = omit(props, 'class');
  return <header class={clsx('bui-sr-only', props.class)} {...rest} />;
}
export function List(props: ReactProps<ComponentProps<'ul'>>) {
  const rest = omit(props, 'class', 'children');
  return (
    <>
      {props.children ? (
        <ul class={clsx('QuickNavList', props.class)} {...rest}>
          {props.children}
        </ul>
      ) : null}
    </>
  );
}
export function Item(props: ReactProps<ComponentProps<'li'>>) {
  const rest = omit(props, 'class');
  return <li class={clsx('QuickNavItem', props.class)} {...rest} />;
}
export function Link(props: ReactProps<ComponentProps<'a'>>) {
  const rest = omit(props, 'class', 'onClick');
  const ga = useGoogleAnalytics();
  const pathname = usePathname();
  const handleClick = (
    event: MouseEvent & {
      currentTarget: HTMLAnchorElement;
      target: Element;
    },
  ) => {
    const slug = rest.href ?? undefined;
    const _pathname = pathname();
    const tocId = slug ? `${_pathname}${slug}` : _pathname;
    ga()?.trackEvent({
      category: 'table_of_contents',
      action: 'click',
      label: tocId,
      params: {
        click: tocId,
        slug: slug || '',
      },
    });
    props.onClick?.(event);
  };

  // The anchor element is interactive via `href` from `...props`, but the
  // lint rules can't see through the spread to know that.
  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
  return <a class={clsx('QuickNavLink', props.class)} {...rest} onClick={handleClick} />;
}
