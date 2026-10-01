import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps, Orientation } from '../types';
import { useRenderElement } from '../useRenderElement';

/**
 * A visual separator between items.
 * Renders a `<div>` element.
 *
 * @internal
 */
export function ListboxSeparator(componentProps: ListboxSeparator.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['orientation']);
  const orientation = () => local.orientation ?? 'horizontal';

  const state: ListboxSeparator.State = {
    get orientation() {
      return orientation();
    },
  };

  const element = useRenderElement('div', componentProps, {
    state,
    props: [{ role: 'presentation' }, elementProps],
  });

  return <>{element()}</>;
}

export interface ListboxSeparatorProps extends BaseUIComponentProps<'div', ListboxSeparatorState> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export interface ListboxSeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export namespace ListboxSeparator {
  export type Props = ListboxSeparatorProps;
  export type State = ListboxSeparatorState;
}
