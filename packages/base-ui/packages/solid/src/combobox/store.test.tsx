import { expect, vi, describe, beforeEach, it } from 'vitest';
import { createRenderEffect, createSignal, onSettled, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { screen } from '@solidjs/testing-library';
import { act, createRenderer } from '#test-utils';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { useComboboxRootContext } from './root/ComboboxRootContext';
import type { ComboboxStore } from './store';

/**
 * Characterization tests for how `AriaCombobox` synchronizes external values into the store.
 *
 * These pin the observable synchronization behavior: transaction shape, timing and form value
 * ownership.
 */
describe('combobox store synchronization', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  /**
   * Every rendered control carrying the form name. Queried by attribute rather than by role
   * because the controls that can carry it span three shapes: the visible `combobox` input, the
   * visually hidden `textbox`, and the `type="hidden"` inputs that `multiple` mode renders, which
   * expose no role at all.
   */
  function namedControls(name: string) {
    return Array.from(document.querySelectorAll(`[name="${name}"]`));
  }

  function StoreProbe(props: { storeRef: { current: ComboboxStore | null } }) {
    props.storeRef.current = useComboboxRootContext();
    return null;
  }

  /**
   * `selectionMode` is always `'none'` for `Autocomplete.Root`, and rendering the input inside the
   * positioner makes `inputInsidePopup` true. That is the configuration where the root's
   * `inputOwnsFormValue` formula disagrees with the one `ComboboxInput` uses for its own `name`,
   * so it is the only place the synchronization transaction is observable.
   */
  function InlineOwnershipFixture(props: {
    inline: boolean;
    storeRef: { current: ComboboxStore | null };
    children?: JSX.Element;
    withPopupInput?: boolean;
  }) {
    return (
      <Autocomplete.Root items={['alpha', 'beta']} inline={props.inline} name="search">
        <StoreProbe storeRef={props.storeRef} />
        {props.children}
        <Autocomplete.Trigger data-testid="trigger" />
        <Autocomplete.Portal keepMounted>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Show when={props.withPopupInput ?? true}>
                <Autocomplete.Input data-testid="popup-input" />
              </Show>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    );
  }

  it('publishes an inline transition in a single store transaction', () => {
    const storeRef: { current: ComboboxStore | null } = { current: null };
    const [inline, setInline] = createSignal(false);

    // `keepMounted` is required: a closed `Combobox.Portal` renders nothing, so without it the
    // popup input never mounts and the test would pass vacuously.
    render(() => <InlineOwnershipFixture inline={inline()} storeRef={storeRef} />);

    const store = storeRef.current!;

    // Solid: a tracked render effect is the store subscription; reads in one flush are consistent.
    const snapshots: Array<{ inline: boolean; inputOwnsFormValue: boolean }> = [];
    render(() => {
      createRenderEffect(
        () => ({ inline: store.state.inline, inputOwnsFormValue: store.state.inputOwnsFormValue }),
        (snapshot) => {
          snapshots.push(snapshot);
        },
      );
      return null;
    });

    act(() => setInline(true));

    // Catches a forward split (inline published before ownership).
    expect(snapshots.some((snapshot) => snapshot.inline && !snapshot.inputOwnsFormValue)).toBe(
      false,
    );

    // Catches a reverse-order split (ownership published before inline), which the assertion
    // above cannot see.
    const changed = snapshots.filter(
      (snapshot, index) =>
        index === 0 ||
        snapshot.inline !== snapshots[index - 1].inline ||
        snapshot.inputOwnsFormValue !== snapshots[index - 1].inputOwnsFormValue,
    );

    // The initial snapshot plus the single transition.
    expect(changed).toHaveLength(2);
    expect(changed[1]).toEqual({ inline: true, inputOwnsFormValue: true });
  });

  it('settles inputOwnsFormValue through the useStore path when inline is set', () => {
    const storeRef: { current: ComboboxStore | null } = { current: null };
    const observed: string[] = [];
    const [inline, setInline] = createSignal(false);

    function OwnershipProbe() {
      const store = useComboboxRootContext();
      const inlineState = store.useState('inline');
      const inputOwnsFormValue = store.useState('inputOwnsFormValue');
      createRenderEffect(
        () => `${inlineState()}:${inputOwnsFormValue()}`,
        (value) => {
          observed.push(value);
        },
      );
      return null;
    }

    render(() => (
      <InlineOwnershipFixture inline={inline()} storeRef={storeRef}>
        <OwnershipProbe />
      </InlineOwnershipFixture>
    ));

    observed.length = 0;
    act(() => setInline(true));

    // The subscription path converges on the value the root computes, not the one
    // `ComboboxInput` uses for its own `name`.
    expect(observed[observed.length - 1]).toBe('true:true');
  });

  it('exposes real commands to a descendant ref callback on the first commit', () => {
    // The vulnerable window is during mount, before the root's effects run. A user interaction
    // happens later and cannot reach it, so the probe fires from a ref callback.
    // `Combobox.Trigger`'s ArrowDown handler reads the `setOpen` command off the store at call
    // time, so this exercises the earliest moment a part can invoke one.
    const handleOpenChange = vi.fn();
    let dispatched = false;

    function EarliestCommandProbe() {
      let triggerElement: HTMLElement | null = null;
      // Solid: a ref callback runs before the element is attached to the document, where
      // delegated handlers cannot see events; the first mount is the equivalent of React's
      // ref-callback-after-commit timing.
      onSettled(() => {
        if (triggerElement && !dispatched) {
          dispatched = true;
          triggerElement.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
          );
        }
      });

      return (
        <Autocomplete.Trigger
          data-testid="trigger"
          ref={(element) => {
            triggerElement = element;
          }}
        />
      );
    }

    render(() => (
      <Autocomplete.Root items={['alpha', 'beta']} onOpenChange={handleOpenChange}>
        <EarliestCommandProbe />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.Input />
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    ));

    expect(dispatched).toBe(true);
    expect(handleOpenChange).toHaveBeenCalled();
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);
  });

  it('gives form value ownership to the hidden input when the input is inside the popup', () => {
    const storeRef: { current: ComboboxStore | null } = { current: null };
    const [withPopupInput, setWithPopupInput] = createSignal(true);

    render(() => (
      <InlineOwnershipFixture
        inline={false}
        storeRef={storeRef}
        withPopupInput={withPopupInput()}
      />
    ));

    const store = storeRef.current!;

    expect(store.state.inputInsidePopup).toBe(true);
    expect(store.state.inputOwnsFormValue).toBe(false);
    // Ownership is a two-sided invariant: asserting only that the popup input lacks the name
    // would still pass if the name were dropped from both controls and the form submitted
    // nothing at all.
    expect(screen.getByTestId('popup-input')).not.toHaveAttribute('name');
    expect(namedControls('search')).toHaveLength(1);
    expect(namedControls('search')[0]).toHaveAttribute('aria-hidden', 'true');

    // Unmounting and remounting the popup input replays its ref callback, which writes the
    // `inputInsidePopup` state ownership is derived from.
    act(() => setWithPopupInput(false));
    expect(namedControls('search')).toHaveLength(1);

    act(() => setWithPopupInput(true));
    expect(store.state.inputOwnsFormValue).toBe(false);
    expect(screen.getByTestId('popup-input')).not.toHaveAttribute('name');
    expect(namedControls('search')).toHaveLength(1);
    expect(namedControls('search')[0]).toHaveAttribute('aria-hidden', 'true');
  });

  // Solid: the test harness has no `renderToString`/`hydrate` renderer, so this asserts the
  // client-rendered ownership that hydration must reach.
  it('keeps form value ownership across hydration', () => {
    render(() => (
      <Autocomplete.Root items={['alpha', 'beta']} name="search">
        <Autocomplete.Input data-testid="input" />
        <Autocomplete.Portal>
          <Autocomplete.Positioner />
        </Autocomplete.Portal>
      </Autocomplete.Root>
    ));

    expect(screen.getByTestId('input')).toHaveAttribute('role', 'combobox');
    expect(namedControls('search')).toHaveLength(1);
    expect(namedControls('search')[0]).toBe(screen.getByTestId('input'));
  });
});
