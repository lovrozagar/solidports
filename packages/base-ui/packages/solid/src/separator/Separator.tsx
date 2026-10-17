import { isStatic } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../solid-helpers';
import { canRenderNative } from '../utils/native';
import { compileStateWriter, renderNativeElement } from '../utils/native/element';
import type { BaseUIComponentProps, Orientation } from '../utils/types';
import { useRenderElement } from '../utils/useRenderElement';

/** The separator's element: a `<div>`; the server renders the same tag. */
const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['orientation']);
const SEPARATOR: Record<string, unknown> = { role: 'separator' };
const writeSeparatorState = compileStateWriter(['orientation'], undefined);

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Separator](https://base-ui.com/react/components/separator)
 */
export function Separator(componentProps: Separator.Props) {
  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX, on the client, the server and while hydrating. A literal orientation needs no effect.
  if (canRenderNative(componentProps, undefined, true)) {
    const orientation = () => componentProps.orientation ?? 'horizontal';
    const state: Separator.State = {
      get orientation() {
        return orientation();
      },
    };
     
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeSeparatorState,
      literal: SEPARATOR,
      attributes: (set) => set('aria-orientation', orientation()),
      reactive: !isStatic(componentProps, 'orientation'),
    }) as unknown as JSX.Element;
  }

  const [, local, elementProps] = splitComponentProps(componentProps, ['orientation']);
  const orientation = () => local.orientation ?? 'horizontal';

  const state: Separator.State = {
    get orientation() {
      return orientation();
    },
  };

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        role: 'separator',
        get 'aria-orientation'() {
          return orientation();
        },
      },
      elementProps,
    ],
    state,
  });

  return element();
}

export interface SeparatorProps extends BaseUIComponentProps<'div', Separator.State> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export interface SeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export namespace Separator {
  export type Props = SeparatorProps;
  export type State = SeparatorState;
}
