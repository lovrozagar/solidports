import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { stopEvent } from '../../floating-ui-solid/utils';
import { splitComponentProps, provideContext } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { canRenderNative, partHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import { provideNativeContext } from '../../utils/native/context';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { NativeElementTemplate, SetAttribute } from '../../utils/native/element';
import { createNativeListItem } from '../../utils/native/listItem';
import type { ReactLikeRef } from '../../solid-helpers';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ComboboxChipContext } from './ComboboxChipContext';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { TextDirection } from '../../internals/direction-context/DirectionContext';
import type { ComboboxStore } from '../store';
import { flushSync } from '../../utils/flushSync';
import { getChipNavigationKeys, getIndexAfterChipRemoval } from '../utils/parts';

/**
 * An individual chip that represents a value in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChip(componentProps: ComboboxChip.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div>` registered with
  // the chips' composite list, with module-level handlers over one model (D32's sweep).
  if (canRenderNative(componentProps)) {
    return renderNativeComboboxChip(componentProps);
  }
  return SlowComboboxChip(componentProps);
}

function SlowComboboxChip(componentProps: ComboboxChip.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const store = useComboboxRootContext();
  const { chipsRef } = useComboboxChipsContext()!;
  const direction = useDirection();

  const disabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const selectedValue = store.useState('selectedValue');

  const { setRef, index } = useCompositeListItem();

  function handleKeyDown(event: KeyboardEvent) {
    return chipKeyDown(store, chipsRef, direction(), index(), selectedValue(), event);
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

          focusAfterChipKeyDown(store, chipsRef, handleKeyDown(event));
        },
      },
      elementProps,
    ],
  });

  const contextValue: ComboboxChipContext = {
    index,
  };

  return provideContext(ComboboxChipContext, contextValue, element);
}

/**
 * A chip's keyboard handling, shared by both paths: the index the focus moves to, or `undefined`
 * for the input.
 */
function chipKeyDown(
  store: ComboboxStore,
  chipsRef: ReactLikeRef<Array<HTMLButtonElement | null | undefined>>,
  dir: TextDirection,
  currentIndex: number,
  currentSelectedValue: any[],
  event: KeyboardEvent,
): number | undefined {
  let nextIndex: number | undefined = currentIndex;
  const [previousChipKey, nextChipKey] = getChipNavigationKeys(dir);

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
    nextIndex = getIndexAfterChipRemoval(currentIndex, currentSelectedValue.length);

    stopEvent(event);

    // Commit the removal before focusing so `chipsRef` reflects the remaining chips.
    flushSync(() => {
      store.context.setIndices({
        activeIndex: null,
        selectedIndex: null,
        type: REASONS.keyboard,
        event,
      });
      store.context.setSelectedValue(
        currentSelectedValue.filter((_: any, i: number) => i !== currentIndex),
        createChangeEventDetails(REASONS.none, event),
      );
    });
  } else if (event.key === 'Enter' || event.key === ' ') {
    stopEvent(event);
    nextIndex = undefined;
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    stopEvent(event);
    // The input may mount when opening.
    flushSync(() => {
      store.context.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event));
    });
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

/** Focuses the chip `chipKeyDown` chose, or the input. */
function focusAfterChipKeyDown(
  store: ComboboxStore,
  chipsRef: ReactLikeRef<Array<HTMLButtonElement | null | undefined>>,
  nextIndex: number | undefined,
) {
  if (nextIndex === undefined) {
    store.context.inputRef.current?.focus();
  } else {
    chipsRef.current[nextIndex]?.focus();
  }
}

const DIV: NativeElementTemplate = { tag: 'div', create: () => (<div />) as unknown as Element };
const NO_OWN_KEYS: ReadonlySet<string> = new Set();
const LITERAL = Object.freeze({ tabindex: -1 });
const writeChipState = compileStateWriter(['disabled'], undefined);

/**
 * A native chip: the target of its module-level handlers and attribute write, its state view, and
 * the chip context its remove button reads (`index`).
 */
class NativeComboboxChipModel {
  declare readonly store: ComboboxStore;
  declare readonly chipsRef: ReactLikeRef<Array<HTMLButtonElement | null | undefined>>;
  declare readonly direction: Accessor<TextDirection>;
  declare readonly index: Accessor<number>;

  constructor(
    store: ComboboxStore,
    chipsRef: ReactLikeRef<Array<HTMLButtonElement | null | undefined>>,
    direction: Accessor<TextDirection>,
    index: Accessor<number>,
  ) {
    this.store = store;
    this.chipsRef = chipsRef;
    this.direction = direction;
    this.index = index;
  }

  get disabled(): boolean {
    return this.store.select('disabled');
  }

  get readOnly(): boolean {
    return this.store.select('readOnly');
  }
}

/** The chip's keydown below the consumer's, as the slow path merges it. */
const CHIP_HANDLERS: Readonly<Record<string, Dispatch<NativeComboboxChipModel>>> = {
  onKeyDown: partHandler<NativeComboboxChipModel, KeyboardEvent>('onKeyDown', (chip, event) => {
    if (chip.disabled || chip.readOnly) {
      return;
    }
    const { store, chipsRef } = chip;
    const nextIndex = chipKeyDown(
      store,
      chipsRef,
      chip.direction(),
      chip.index(),
      store.state.selectedValue,
      event,
    );
    focusAfterChipKeyDown(store, chipsRef, nextIndex);
  }),
};

/** The chip's own attributes below the consumer's: one write per pass. */
function writeChipAttributes(w: SetAttribute, chip: NativeComboboxChipModel) {
  w.set('aria-disabled', chip.disabled ? 'true' : undefined);
  w.set('aria-readonly', chip.readOnly ? 'true' : undefined);
}

const chipState = (chip: NativeComboboxChipModel) => chip;

/** Renders a chip natively: a `<div>` registered with the chips' composite list. */
function renderNativeComboboxChip(props: ComboboxChip.Props): JSX.Element {
  const store = useComboboxRootContext();
  const { chipsRef } = useComboboxChipsContext()!;
  const listItem = createNativeListItem<null>(null);
  const model = new NativeComboboxChipModel(store, chipsRef, useDirection(), listItem.index);
  return provideNativeContext(ComboboxChipContext, model, () =>
    renderNativeElement(DIV, props, {
      own: NO_OWN_KEYS,
      state: chipState,
      stateWriter: writeChipState,
      stateView: model,
      reactive: true,
      literal: LITERAL,
      attributes: writeChipAttributes,
      handlers: CHIP_HANDLERS,
      handlerTarget: model,
      refs: [listItem.setRef],
    }),
  ) as unknown as JSX.Element;
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
