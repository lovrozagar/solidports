import { createSignal } from 'solid-js';
import { isServer, type JSX } from '@solidjs/web';
import { splitComponentProps, useRef } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { isAndroid } from '../../utils/detectBrowser';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, BaseUIHTMLProps, HTMLProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import {
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from '../root/FilterDropdownRootContext';
import { isRefocusingOwner, refocusOwner } from '../utils/refocusOwner';

/** Server HTML needs a `value` attribute. The client writes the DOM property only when it changes. */
export function filterInputValueProps(server: boolean, read: () => string): BaseUIHTMLProps {
  return (
    server
      ? {
          get value() {
            return read();
          },
        }
      : {
          get 'prop:value'() {
            return read();
          },
        }
  ) as unknown as BaseUIHTMLProps;
}

/**
 * The text input that owns the filter query. The host supplies list-navigation props.
 */
export function FilterDropdownInput(componentProps: FilterDropdownInput.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'id',
    'disabled',
    'activeItemId',
    'navigationProps',
  ]);
  const disabled = () => local.disabled ?? false;
  const activeItemId = () => local.activeItemId;
  const id = useBaseUiId(() => (local.id === false ? undefined : local.id));

  const context = useFilterDropdownRootContext();
  const { listRef } = useFilterDropdownItemContext();
  const value = useFilterDropdownValueContext();

  const [composingValue, setComposingValue] = createSignal<string | null>(null);
  let isComposing = false;

  function commitValue(nextValue: string, nativeEvent: Event) {
    // The input keeps focus until the popup unmounts. An edit made while it animates out would
    // land after the close reset the query and carry over into the next open.
    if (!context.open()) {
      return;
    }
    const reason = nextValue === '' ? REASONS.inputClear : REASONS.inputChange;
    context.onValueChange(nextValue, createChangeEventDetails(reason, nativeEvent));
  }

  const displayedValue = () => composingValue() ?? value();
  // `prop:value` writes `input.value` only when the text changes, so a mid-string caret survives.
  // It does not serialize into server HTML, so the server render uses the `value` attribute.
  const valueProps = filterInputValueProps(isServer, displayedValue);

  const state: FilterDropdownInput.State = {
    get highlighted() {
      return context.inputFocusVisible() && (!context.keyboardModality() || activeItemId() == null);
    },
  };

  const element = useRenderElement('input', componentProps, {
    state,
    ref: [context.focusOwnerRef],
    props: [
      local.navigationProps,
      valueProps,
      {
        get id() {
          return id();
        },
        type: 'text',
        get disabled() {
          return context.disabled() || disabled();
        },
        get 'aria-activedescendant'() {
          return activeItemId();
        },
        role: 'searchbox',
        inputmode: 'search',
        autocomplete: 'off',
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'none',
        get 'aria-controls'() {
          return context.listId();
        },
        onCompositionStart(event: CompositionEvent) {
          if (isAndroid) {
            return;
          }
          isComposing = true;
          setComposingValue((event.currentTarget as HTMLInputElement).value);
        },
        onCompositionEnd(event: CompositionEvent) {
          if (!isComposing) {
            return;
          }
          isComposing = false;
          setComposingValue(null);
          commitValue((event.currentTarget as HTMLInputElement).value, event);
        },
        onInput(event: InputEvent) {
          const input = event.currentTarget as HTMLInputElement;
          if (isComposing) {
            setComposingValue(input.value);
            return;
          }
          commitValue(input.value, event);
        },
        onKeyDown() {
          context.setKeyboardModality(true);
        },
        onPointerDown() {
          context.setKeyboardModality(false);
        },
        onMouseEnter(event: MouseEvent) {
          context.setKeyboardModality(false);
          if (context.open()) {
            refocusOwner(event.currentTarget as HTMLElement);
          }
        },
        onFocus(event: FocusEvent) {
          context.setInputFocusVisible(true);
          if (context.autoHighlight() === 'always' || isRefocusingOwner()) {
            return;
          }
          const from = event.relatedTarget as HTMLElement | null;
          if (from !== null && listRef.current.includes(from)) {
            context.setActiveIndex(null);
          }
        },
        onBlur() {
          context.setInputFocusVisible(false);
        },
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface FilterDropdownInputState {
  /** Whether the input shows its focus ring. Cleared when keyboard navigation highlights an item. */
  highlighted: boolean;
}

export interface FilterDropdownInputProps extends BaseUIComponentProps<
  'input',
  FilterDropdownInputState
> {
  /** The id of the item the host highlights, which the input points at while it holds focus. */
  activeItemId?: string | undefined;
  /**
   * The host's list navigation props. The host routes key presses itself, so these exclude a
   * key handler.
   */
  navigationProps?: HTMLProps | undefined;
}

export namespace FilterDropdownInput {
  export type Props = FilterDropdownInputProps;
  export type State = FilterDropdownInputState;
}

export type { JSX };
