import { contains } from '../../floating-ui-solid/utils';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import type { Side } from '../../utils/useAnchorPositioning';
import { useRenderElement } from '../../utils/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import { handleInputPress } from '../utils/handleInputPress';
import { useListEmpty, usePopupSide } from '../utils/parts';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * A wrapper for the input and its associated controls.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxInputGroup(componentProps: ComboboxInputGroup.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { state: fieldState } = useFieldRootContext();
  const store = useComboboxRootContext();

  const open = store.useState('open');
  const comboboxDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const hasSelectedValue = store.useState('hasSelectedValue');
  const selectionMode = store.useState('selectionMode');

  const popupSide = usePopupSide(store);
  const disabled = comboboxDisabled;
  const listEmpty = useListEmpty();
  const placeholder = () => (selectionMode() === 'none' ? false : !hasSelectedValue());

  const state: ComboboxInputGroup.State = solidMergeProps(fieldState, {
    get open() {
      return open();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get popupSide() {
      return popupSide();
    },
    get listEmpty() {
      return listEmpty();
    },
    get placeholder() {
      return placeholder();
    },
  });

  const setInputGroupElement = (element: HTMLDivElement | null | undefined) => {
    store.set('inputGroupElement', element);
  };

  const element = useRenderElement('div', componentProps, {
    ref: setInputGroupElement,
    props: [
      {
        role: 'group',
        onMouseDown(event: MouseEvent) {
          handleInputPress(event, store, disabled(), (target) => {
            return contains(store.context.chipsContainerRef.current, target);
          });
        },
      },
      elementProps,
    ],
    state,
    stateAttributesMapping: triggerStateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface ComboboxInputGroupState extends FieldRoot.State {
  /**
   * Whether the corresponding popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxInputGroupProps extends BaseUIComponentProps<
  'div',
  ComboboxInputGroup.State
> {}

export namespace ComboboxInputGroup {
  export type State = ComboboxInputGroupState;
  export type Props = ComboboxInputGroupProps;
}
