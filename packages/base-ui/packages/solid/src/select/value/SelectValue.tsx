/* eslint-disable typescript/no-explicit-any -- generic Value erased at value renderer */
import { createMemo, Match, Switch } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { resolveMultipleLabels, resolveSelectedLabel } from '../../utils/resolveValueLabel';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useSelectRootContext } from '../root/SelectRootContext';

const stateAttributesMapping: StateAttributesMapping<SelectValue.State> = {
  value: () => null,
};

/**
 * A text label of the currently selected item.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectValue(componentProps: SelectValue.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['children', 'placeholder']);

  const { store, valueRef } = useSelectRootContext();

  const value = store.useState('value');
  const items = store.useState('items');
  const itemToStringLabel = store.useState('itemToStringLabel');
  const hasSelectedValue = store.useState('hasSelectedValue');

  const shouldCheckNullItemLabel = () =>
    !hasSelectedValue() && local.placeholder != null && local.children == null;
  const hasNullLabel = store.useState('hasNullItemLabel', shouldCheckNullItemLabel);

  const state: SelectValue.State = {
    get placeholder() {
      return !hasSelectedValue();
    },
    get value() {
      return value();
    },
  };

  // One read: each read of JSX children creates them anew.
  const children = createMemo(() => componentProps.children);

  const element = useRenderElement('span', componentProps, {
    get children() {
      return (
        <Switch fallback={<>{resolveSelectedLabel(value(), items(), itemToStringLabel())}</>}>
          <Match when={typeof children() === 'function'}>{(children() as Function)(value())}</Match>
          <Match when={children() != null}>{children() as JSX.Element}</Match>
          <Match when={!hasSelectedValue() && local.placeholder != null && !hasNullLabel()}>
            {local.placeholder}
          </Match>
          <Match when={Array.isArray(value())}>
            {resolveMultipleLabels(value(), items(), itemToStringLabel())}
          </Match>
        </Switch>
      );
    },
    props: elementProps,
    ref: (el) => {
      valueRef.current = el;
    },
    state,
    stateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface SelectValueState {
  /**
   * The value of the currently selected item.
   */
  value: any;
  /**
   * Whether the placeholder is being displayed.
   */
  placeholder: boolean;
}

export interface SelectValueProps extends Omit<
  BaseUIComponentProps<'span', SelectValue.State>,
  'children'
> {
  /**
   * Accepts a function that returns a `ReactNode` to format the selected value.
   * Treat the value as read-only: in `multiple` mode it may be a shared frozen array
   * when nothing is selected.
   * @example
   * ```tsx
   * <Select.Value>
   *   {(value: string | null) => value ? labels[value] : 'No value'}
   * </Select.Value>
   * ```
   */
  children?: JSX.Element | ((value: any) => JSX.Element);
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: JSX.Element;
}

export namespace SelectValue {
  export type State = SelectValueState;
  export type Props = SelectValueProps;
}
