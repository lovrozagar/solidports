import { createMemo, Show } from 'solid-js';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import { useComboboxInputValueContext, useComboboxRootContext } from '../root/ComboboxRootContext';

const stateAttributesMapping: StateAttributesMapping<ComboboxClear.State> = {
  ...transitionStatusMapping,
  ...triggerOpenStateMapping,
};

/**
 * Clears the value when clicked.
 * Renders a `<button>` element.
 */
export function ComboboxClear(componentProps: ComboboxClear.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'nativeButton',
    'keepMounted',
  ]);
  const disabledProp = () => Boolean(local.disabled);
  const nativeButton = () => Boolean(local.nativeButton ?? true);
  const keepMounted = () => local.keepMounted ?? false;

  const { disabled: fieldDisabled } = useFieldRootContext();
  const store = useComboboxRootContext();

  const selectionMode = store.useState('selectionMode');
  const comboboxDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const open = store.useState('open');
  const selectedValue = store.useState('selectedValue');
  const hasSelectionChips = store.useState('hasSelectionChips');

  const inputValue = useComboboxInputValueContext();

  const visible = createMemo(() => {
    if (selectionMode() === 'none') {
      return inputValue() !== '';
    }
    if (selectionMode() === 'single') {
      return selectedValue() != null;
    }
    return hasSelectionChips();
  });

  const disabled = () => fieldDisabled() || comboboxDisabled() || disabledProp();

  const { buttonRef, getButtonProps } = useButton({
    disabled,
    native: nativeButton,
  });

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(() => visible());

  const state: ComboboxClear.State = {
    get disabled() {
      return disabled();
    },
    get visible() {
      return visible();
    },
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  useOpenChangeComplete({
    onComplete() {
      if (!visible()) {
        setMounted(false);
      }
    },
    open: visible,
    ref: () => store.context.clearRef.current,
  });

  const element = useRenderElement('button', componentProps, {
    props: [
      {
        tabindex: -1,
        children: 'x',
        // Avoid stealing focus from the input.
        onMouseDown(event: MouseEvent) {
          event.preventDefault();
        },
        onClick(event: MouseEvent) {
          if (disabled() || readOnly()) {
            return;
          }

          const type = store.context.keyboardActiveRef.current ? REASONS.keyboard : REASONS.pointer;

          store.context.setInputValue('', createChangeEventDetails(REASONS.clearPress, event));

          if (selectionMode() !== 'none') {
            store.context.setSelectedValue(
              Array.isArray(selectedValue()) ? [] : null,
              createChangeEventDetails(REASONS.clearPress, event),
            );
            store.context.setIndices({ activeIndex: null, selectedIndex: null, type });
          } else {
            store.context.setIndices({ activeIndex: null, type });
          }

          store.context.inputRef.current?.focus();
        },
      },
      elementProps,
      getButtonProps,
    ],
    ref: (el) => {
      buttonRef(el);
      store.context.clearRef.current = el;
    },
    state,
    stateAttributesMapping,
  });

  const shouldRender = () => keepMounted() || mounted();

  return <Show when={shouldRender()}>{element()}</Show>;
}

export interface ComboboxClearState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the clear button should be visible.
   */
  visible: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface ComboboxClearProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxClear.State> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the component should remain mounted in the DOM when not visible.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace ComboboxClear {
  export type State = ComboboxClearState;
  export type Props = ComboboxClearProps;
}
