import { CompositeList } from '../../internals/composite/list/CompositeList';
import { splitComponentProps, useRef } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/constants';
import { BaseUIComponentProps } from '../../utils/types';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { handleInputPress } from '../utils/handleInputPress';
import { ComboboxChipsContext } from './ComboboxChipsContext';

const TOOLBAR_ROLE = { role: 'toolbar' } as const;

/**
 * A container for the chips in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChips(componentProps: ComboboxChips.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const store = useComboboxRootContext();

  const hasSelectionChips = store.useState('hasSelectionChips');

  const chipsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const element = useRenderElement('div', componentProps, {
    ref: (el) => {
      store.context.chipsContainerRef.current = el;
    },
    // NVDA enters browse mode instead of staying in focus mode when navigating with
    // arrow keys inside a container unless it has a toolbar role.
    props: [
      propsSourceAccessor(() => (hasSelectionChips() ? TOOLBAR_ROLE : EMPTY_OBJECT)),
      {
        onMouseDown(event: MouseEvent) {
          handleInputPress(event, store, store.state.disabled);
        },
      },
      elementProps,
    ],
  });

  const contextValue: ComboboxChipsContext = { chipsRef };

  return (
    <ComboboxChipsContext value={contextValue}>
      <CompositeList refs={{ elements: chipsRef.current }}>{element()}</CompositeList>
    </ComboboxChipsContext>
  );
}

export interface ComboboxChipsState {}

export interface ComboboxChipsProps extends BaseUIComponentProps<'div', ComboboxChips.State> {}

export namespace ComboboxChips {
  export type State = ComboboxChipsState;
  export type Props = ComboboxChipsProps;
}
