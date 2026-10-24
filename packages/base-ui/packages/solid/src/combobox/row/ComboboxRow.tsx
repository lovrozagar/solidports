import type { JSX } from '@solidjs/web';
import { provideContext, splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { provideNativeContext } from '../../utils/native/context';
import { renderNativeElement } from '../../utils/native/element';
import type { NativeElementTemplate } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { ComboboxRowContext } from './ComboboxRowContext';

const ROW: NativeElementTemplate = {
  tag: 'div',
  attributes: { role: 'row' },
  create: () => (<div role="row" />) as unknown as Element,
};
const NO_OWN_KEYS: ReadonlySet<string> = new Set();

/**
 * Displays a single row of items in a grid list.
 * Enable `grid` on the root component to turn the listbox into a grid.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxRow(componentProps: ComboboxRow.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div role="row">` that
  // tells its items they sit in a row, on the client, the server and while hydrating (D32). It
  // takes no id and runs no effect, so hydration keys stay aligned with the slow path's.
  if (canRenderNative(componentProps, undefined, true)) {
    return provideNativeContext(ComboboxRowContext, true, () =>
      renderNativeElement(ROW, componentProps, { own: NO_OWN_KEYS, reactive: false }),
    ) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const element = useRenderElement('div', componentProps, {
    props: [{ role: 'row' }, elementProps],
  });

  return provideContext(ComboboxRowContext, true, () => <>{element()}</>);
}

export interface ComboboxRowState {}

export interface ComboboxRowProps extends BaseUIComponentProps<'div', ComboboxRow.State> {}

export namespace ComboboxRow {
  export type State = ComboboxRowState;
  export type Props = ComboboxRowProps;
}
