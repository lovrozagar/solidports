/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { stopEvent } from '../../floating-ui-solid/utils';
import { splitComponentProps } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ComboboxChipContext } from './ComboboxChipContext';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { flushSync } from '../../utils/flushSync';
import { getChipNavigationKeys, getIndexAfterChipRemoval } from '../utils/parts';

/**
 * An individual chip that represents a value in a multiselectable input.
 * Renders a `<div>` element.
 */
export function ComboboxChip(componentProps: ComboboxChip.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const store = useComboboxRootContext();
  const { setHighlightedChipIndex, chipsRef } = useComboboxChipsContext()!;
  const direction = useDirection();

  const disabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const selectedValue = store.useState('selectedValue');

  const { setRef, index } = useCompositeListItem();

  function handleKeyDown(event: KeyboardEvent) {
    const currentIndex = index();
    let nextIndex: number | undefined = currentIndex;
    const [previousChipKey, nextChipKey] = getChipNavigationKeys(direction());

    if (event.key === previousChipKey) {
      event.preventDefault();
      if (currentIndex > 0) {
        nextIndex = currentIndex - 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === nextChipKey) {
      event.preventDefault();
      if (currentIndex < chipsRef.current.length - 1) {
        nextIndex = currentIndex + 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      const currentSelectedValue = selectedValue();
      nextIndex = getIndexAfterChipRemoval(currentIndex, currentSelectedValue.length);

      stopEvent(event);

      store.context.setIndices({
        activeIndex: null,
        selectedIndex: null,
        type: REASONS.keyboard,
      });
      store.context.setSelectedValue(
        currentSelectedValue.filter((_: any, i: number) => i !== currentIndex),
        createChangeEventDetails(REASONS.none, event),
      );
    } else if (event.key === 'Enter' || event.key === ' ') {
      stopEvent(event);
      nextIndex = undefined;
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      stopEvent(event);
      store.context.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
      nextIndex = undefined;
    } else if (
      // Check for printable characters (letters, numbers, symbols)
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      nextIndex = undefined;
    }

    return nextIndex;
  }

  const state: ComboboxChip.State = {
    get disabled() {
      return disabled();
    },
  };

  const element = useRenderElement('div', componentProps, {
    ref: setRef,
    state,
    props: [
      {
        tabindex: -1,
        get 'aria-disabled'() {
          return disabled() ? 'true' : undefined;
        },
        get 'aria-readonly'() {
          return readOnly() ? 'true' : undefined;
        },
        onKeyDown(event: KeyboardEvent) {
          if (disabled() || readOnly()) {
            return;
          }

          const nextIndex = handleKeyDown(event);

          flushSync(() => {
            setHighlightedChipIndex(nextIndex);
          });

          if (nextIndex === undefined) {
            store.context.inputRef.current?.focus();
          } else {
            chipsRef.current[nextIndex]?.focus();
          }
        },
      },
      elementProps,
    ],
  });

  const contextValue: ComboboxChipContext = {
    index,
  };

  return <ComboboxChipContext value={contextValue}>{element()}</ComboboxChipContext>;
}

export interface ComboboxChipState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipProps extends BaseUIComponentProps<'div', ComboboxChip.State> {}

export namespace ComboboxChip {
  export type State = ComboboxChipState;
  export type Props = ComboboxChipProps;
}
