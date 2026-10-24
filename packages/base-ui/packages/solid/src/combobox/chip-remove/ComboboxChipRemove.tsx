import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { stopEvent } from '../../floating-ui-solid/utils';
import { omitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { findItemIndex } from '../../utils/itemEquality';
import { REASONS } from '../../utils/reasons';
import { getHighlightReason } from '../../utils/getHighlightReason';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { canRenderNative, partHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { NativeElementTemplate, SetAttribute } from '../../utils/native/element';
import type { ComboboxStore } from '../store';
import { useComboboxChipContext } from '../chip/ComboboxChipContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

/**
 * A button to remove a chip.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChipRemove(componentProps: ComboboxChipRemove.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<button>` with
  // `useButton`'s focusable-when-disabled gates inlined, over one model (D32's sweep).
  if (canRenderNative(componentProps, ['nativeButton']) && (componentProps.nativeButton ?? true)) {
    return renderNativeChipRemove(componentProps);
  }
  return SlowComboboxChipRemove(componentProps);
}

function SlowComboboxChipRemove(componentProps: ComboboxChipRemove.Props) {
  const elementProps = omitComponentProps(componentProps, ['disabled', 'nativeButton'] as const);
  const disabledProp = () => Boolean(componentProps.disabled);
  const nativeButton = () => Boolean(componentProps.nativeButton ?? true);

  const store = useComboboxRootContext();
  const { index } = useComboboxChipContext();

  const comboboxDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');

  const disabled = () => comboboxDisabled() || disabledProp();

  const { buttonSources, buttonRef } = useButton({
    disabled: () => disabled() || readOnly(),
    focusableWhenDisabled: true,
    native: nativeButton,
  });

  const state: ComboboxChipRemove.State = {
    get disabled() {
      return disabled();
    },
  };

  const element = useRenderElement('button', componentProps, {
    props: [
      ...buttonSources.attributes,
      {
        tabindex: -1,
        onMouseDown(event: MouseEvent) {
          event.preventDefault();
        },
        onClick(event: MouseEvent) {
          if (disabled() || readOnly()) {
            return;
          }

          const eventDetails = removeChip(store, index(), event);
          if (!eventDetails.isPropagationAllowed) {
            event.stopPropagation();
          }
        },
        onKeyDown(event: KeyboardEvent) {
          if (disabled() || readOnly()) {
            return;
          }

          if (event.key === 'Enter' || event.key === ' ') {
            const eventDetails = removeChip(store, index(), event);
            if (!eventDetails.isPropagationAllowed) {
              stopEvent(event);
            }
          }
        },
      },
      elementProps,
      buttonSources.handlers,
    ],
    ref: buttonRef,
    state,
  });

  return element();
}

/** Clears the highlight when the removed chip's item is the highlighted one. */
function clearActiveIndexForRemovedItem(store: ComboboxStore, removedItem: any, event: Event) {
  const activeIndex = store.state.activeIndex;

  if (activeIndex == null) {
    return;
  }

  // Try current visible list first; if not found, it's filtered out.
  // No need to clear highlight in that case since it can't equal activeIndex.
  const removedIndex = findItemIndex(
    store.context.valuesRef.current,
    removedItem,
    store.state.isItemEqualToValue,
  );
  if (removedIndex !== -1 && activeIndex === removedIndex) {
    store.context.setIndices({
      activeIndex: null,
      type: getHighlightReason(event),
      event,
    });
  }
}

/** Removes the chip at `idx` from the value and returns focus to the input. */
function removeChip(store: ComboboxStore, idx: number, event: MouseEvent | KeyboardEvent) {
  const val = store.state.selectedValue;
  const eventDetails = createChangeEventDetails(REASONS.chipRemovePress, event);
  const removedItem = val[idx];

  clearActiveIndexForRemovedItem(store, removedItem, event);

  store.context.setSelectedValue(
    val.filter((_: any, i: number) => i !== idx),
    eventDetails,
  );

  store.context.inputRef.current?.focus();
  return eventDetails;
}

const BUTTON: NativeElementTemplate = {
  tag: 'button',
  attributes: { type: 'button', tabindex: '-1' },
  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- labelled by the part's children
  create: () => (<button type="button" tabindex="-1" />) as unknown as Element,
};
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'nativeButton']);
const writeRemoveState = compileStateWriter(['disabled'], undefined);

/** A native remove button: the target of its module-level handlers, attribute write and state. */
class NativeChipRemoveModel {
  declare private readonly props: ComboboxChipRemove.Props;
  declare readonly store: ComboboxStore;
  declare readonly index: Accessor<number>;

  constructor(props: ComboboxChipRemove.Props, store: ComboboxStore, index: Accessor<number>) {
    this.props = props;
    this.store = store;
    this.index = index;
  }

  /** The state's `disabled`: the combobox's or the button's own. */
  get disabled(): boolean {
    return this.store.select('disabled') || Boolean(this.props.disabled);
  }

  /** `useButton`'s `disabled`: a read-only combobox blocks the button too. */
  get blocked(): boolean {
    return this.disabled || this.store.select('readOnly');
  }
}

/** `useButton`'s gate: a blocked button cancels the event and runs no handler. */
function preventWhileBlocked(remove: NativeChipRemoveModel, event: Event) {
  if (remove.blocked) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (remove: NativeChipRemoveModel) => !remove.blocked;

function removeFromEvent(remove: NativeChipRemoveModel, event: MouseEvent | KeyboardEvent) {
  return removeChip(remove.store, remove.index(), event);
}

/**
 * The button's handlers in the slow path's `mergeProps` order: `useButton`'s gate, then the
 * consumer's handler, then the button's own, created once.
 */
const REMOVE_HANDLERS: Readonly<Record<string, Dispatch<NativeChipRemoveModel>>> = {
  onClick: partHandler<NativeChipRemoveModel, MouseEvent>(
    'onClick',
    (remove, event) => {
      if (remove.blocked) {
        return;
      }
      if (!removeFromEvent(remove, event).isPropagationAllowed) {
        event.stopPropagation();
      }
    },
    preventWhileBlocked,
  ),
  onPointerDown: partHandler<NativeChipRemoveModel, PointerEvent>(
    'onPointerDown',
    undefined,
    preventWhileBlocked,
  ),
  onMouseDown: partHandler<NativeChipRemoveModel, MouseEvent>(
    'onMouseDown',
    (_remove, event) => {
      event.preventDefault();
    },
    runWhileEnabled,
  ),
  onKeyDown: partHandler<NativeChipRemoveModel, KeyboardEvent>(
    'onKeyDown',
    (remove, event) => {
      if (remove.blocked) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (!removeFromEvent(remove, event).isPropagationAllowed) {
          stopEvent(event);
        }
      }
    },
    (remove, event) => {
      // `useFocusableWhenDisabled`: a blocked button keeps Tab and cancels every other key.
      if (remove.blocked && event.key !== 'Tab') {
        event.preventDefault();
      }
      return !remove.blocked;
    },
  ),
};

/** Bound only when the consumer passes them: `useButton`'s gate around the consumer's handler. */
const REMOVE_HANDLERS_IF_PASSED: Readonly<Record<string, Dispatch<NativeChipRemoveModel>>> = {
  onKeyUp: partHandler<NativeChipRemoveModel>('onKeyUp', undefined, runWhileEnabled),
};

/** `useButton`'s attributes for a focusable-when-disabled native button: one write per pass. */
function writeRemoveAttributes(w: SetAttribute, remove: NativeChipRemoveModel) {
  w.set('aria-disabled', String(remove.blocked));
}

const removeState = (remove: NativeChipRemoveModel) => remove;

/** Renders a remove button natively for `props`. */
function renderNativeChipRemove(props: ComboboxChipRemove.Props): JSX.Element {
  const model = new NativeChipRemoveModel(
    props,
    useComboboxRootContext(),
    useComboboxChipContext().index,
  );
  return renderNativeElement(BUTTON, props, {
    own: OWN_KEYS,
    state: removeState,
    stateWriter: writeRemoveState,
    stateView: model,
    reactive: true,
    attributes: writeRemoveAttributes,
    handlers: REMOVE_HANDLERS,
    handlersIfPassed: REMOVE_HANDLERS_IF_PASSED,
    handlerTarget: model,
  }) as unknown as JSX.Element;
}

export interface ComboboxChipRemoveState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipRemoveProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxChipRemove.State> {}

export namespace ComboboxChipRemove {
  export type State = ComboboxChipRemoveState;
  export type Props = ComboboxChipRemoveProps;
}
