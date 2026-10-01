import { mergeProps as solidMergeProps } from 'solid-js';
import { contains } from '../../floating-ui-solid/utils';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import type { Side } from '../../utils/useAnchorPositioning';
import { useRenderElement } from '../../utils/useRenderElement';
import {
  useComboboxDerivedItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import { handleInputPress } from '../utils/handleInputPress';

/**
 * A wrapper for the input and its associated controls.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxInputGroup(componentProps: ComboboxInputGroup.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { state: fieldState } = useFieldRootContext();
  const { store } = useComboboxRootContext();
  const { filteredItems } = useComboboxDerivedItemsContext();

  const open = store.useSelector('open');
  const mounted = store.useSelector('mounted');
  const popupSideValue = store.useState('popupSide');
  const positionerElement = store.useState('positionerElement');
  const comboboxDisabled = store.useSelector('disabled');
  const readOnly = store.useSelector('readOnly');
  const hasSelectedValue = store.useSelector('hasSelectedValue');
  const selectionMode = store.useSelector('selectionMode');

  const popupSide = () => (mounted() && positionerElement() ? popupSideValue() : null);
  const disabled = () => comboboxDisabled();
  const listEmpty = () => filteredItems().length === 0;
  const placeholder = () => (selectionMode() === 'none' ? false : !hasSelectedValue());

  const state: ComboboxInputGroup.State = solidMergeProps(fieldState, {
    get disabled() {
      return disabled();
    },
    get listEmpty() {
      return listEmpty();
    },
    get open() {
      return open();
    },
    get placeholder() {
      return placeholder();
    },
    get popupSide() {
      return popupSide();
    },
    get readOnly() {
      return readOnly();
    },
  });

  const setInputGroupElement = (element: HTMLDivElement | null | undefined) => {
    store.set('inputGroupElement', element);
  };

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        role: 'group',
        onMouseDown(event: MouseEvent) {
          handleInputPress(event, store, disabled(), readOnly(), (target) => {
            return contains(store.state.chipsContainerRef, target);
          });
        },
      },
      elementProps,
    ],
    ref: (el) => {
      setInputGroupElement(el);
    },
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

export interface ComboboxInputGroupProps
  extends BaseUIComponentProps<'div', ComboboxInputGroup.State> {}

export namespace ComboboxInputGroup {
  export type State = ComboboxInputGroupState;
  export type Props = ComboboxInputGroupProps;
}
