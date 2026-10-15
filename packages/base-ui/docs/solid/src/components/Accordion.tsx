import { createEffect, createSignal, merge, omit } from 'solid-js';
import { Dynamic } from '@solidjs/web';
import { reactRef, reactStyle } from 'docs/src/adapters/react';
import type { ComponentProps, JSX, ValidComponent } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { useGoogleAnalytics } from 'docs/src/blocks/GoogleAnalyticsProvider';
import { observeScrollableInner } from '../utils/observeScrollableInner';

export function Root(props: ReactProps<ComponentProps<'section'>>) {
  return <section {...props} class={clsx('AccordionRoot', props.class)} />;
}
export function Trigger(props: ReactProps<ComponentProps<'summary'>>) {
  return (
    <summary
      {...props}
      class={clsx('AccordionTrigger', props.class)}
      onClick={(event) => {
        const selection = window.getSelection();
        if (!selection?.isCollapsed) {
          event.preventDefault();
        }
        props.onClick?.(event);
      }}
      onMouseDown={(event) => {
        if (!event.defaultPrevented && event.detail > 1) {
          event.preventDefault();
        }
      }}
    />
  );
}
export function Item(
  props: ReactProps<ComponentProps<'details'>> & {
    gaCategory?: string;
    gaLabel?: string;
    gaParams?: Record<string, string | number | boolean>;
  },
) {
  const rest = omit(props, 'gaCategory', 'gaLabel', 'gaParams');
  const [open, setOpen] = createSignal<boolean>(false);
  const detailsRef: {
    current: HTMLDetailsElement | null;
  } = {
    current: null,
  };
  const ga = useGoogleAnalytics();

  // in Chrome, the <details> opens automatically when the hash part of a URL
  // matches the `id` on <summary> but needs to be manually handled for Safari
  // and Firefox
  const checkHash = () => {
    const element = detailsRef.current;
    if (element) {
      const trigger = element.querySelector<HTMLElement>('summary');
      const triggerId = trigger?.getAttribute('id');
      const hash = window.location.hash.slice(1);
      if (triggerId && hash && triggerId === hash) {
        setOpen(true);
      }
    }
  };
  createEffect(
    () => [checkHash],
    () => {
      checkHash();
      window.addEventListener('hashchange', checkHash);
      return () => {
        window.removeEventListener('hashchange', checkHash);
      };
    },
  );
  return (
    <details
      {...rest}
      ref={(element) => {
        detailsRef.current = element;
      }}
      open={open() || undefined}
      class={clsx('AccordionItem', rest.class)}
      onToggle={(event) => {
        rest.onToggle?.(event);
        setOpen(event.currentTarget.open);
        if (props.gaCategory && event.currentTarget.open && event.isTrusted) {
          ga()?.trackEvent({
            category: props.gaCategory,
            action: 'expand',
            label: props.gaLabel,
            params: props.gaParams,
          });
        }
      }}
    />
  );
}
export function Panel(props: ReactProps<ComponentProps<'div'>>) {
  return <div {...props} class={clsx('AccordionPanel', props.class)} />;
}
export function Content(props: ReactProps<ComponentProps<'div'>>) {
  return <div {...props} class={clsx('AccordionContent', props.class)} />;
}

/* Scroll container with an overscroll overlay graphic for overflowing content inside the trigger */
export function Scrollable(
  _props: ReactProps<ComponentProps<'span'>> & {
    gradientColor?: string;
    tag?: ValidComponent;
  },
) {
  const props = merge(
    {
      tag: 'span',
      gradientColor: 'var(--color-content)',
    },
    _props,
  );
  const rest = omit(props, 'children', 'class', 'tag', 'gradientColor');
  return (
    <Dynamic
      component={props.tag}
      ref={reactRef(observeScrollableInner)}
      class={clsx('AccordionScrollable', props.class)}
      style={reactStyle({
        '--scrollable-gradient-color': props.gradientColor,
      } as JSX.CSSProperties)}
      {...rest}
    >
      <Dynamic component={props.tag} class="AccordionScrollableInner">
        {props.children}
      </Dynamic>
    </Dynamic>
  );
}

/* Fake <tr> */
export function HeaderRow(props: ReactProps<ComponentProps<'div'>>) {
  return <div {...props} aria-hidden="true" class={clsx('AccordionHeaderRow', props.class)} />;
}

/* Fake <th scope="col"> */
export function HeaderCell(props: ReactProps<ComponentProps<'div'>>) {
  const rest = omit(props, 'children', 'class');
  return (
    <div {...rest} class={clsx('AccordionHeaderCell', props.class)}>
      <span class="AccordionHeaderCellInner">{props.children}</span>
    </div>
  );
}
