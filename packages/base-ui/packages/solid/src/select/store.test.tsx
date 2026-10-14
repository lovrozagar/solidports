import { expect, vi, describe, beforeEach, it } from 'vitest';
import { createRenderEffect, createSignal } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { act, createRenderer } from '#test-utils';
import { Select } from '@solidports/base-ui/select';
import { useSelectRootContext } from './root/SelectRootContext';
import type { SelectStore } from './store';
import { createChangeEventDetails } from '../utils/createBaseUIEventDetails';
import { REASONS } from '../utils/reasons';

describe('select store synchronization', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  function StoreProbe(props: { storeRef: { current: SelectStore | null } }) {
    props.storeRef.current = useSelectRootContext().store;
    return null;
  }

  it('publishes synchronized values in a single store transaction', () => {
    const storeRef: { current: SelectStore | null } = { current: null };
    const [fixtureProps, setFixtureProps] = createSignal({
      id: 'first',
      modal: true,
      disabled: false,
    });

    render(() => (
      <Select.Root
        id={fixtureProps().id}
        modal={fixtureProps().modal}
        disabled={fixtureProps().disabled}
      >
        <StoreProbe storeRef={storeRef} />
        <Select.Trigger />
      </Select.Root>
    ));

    const store = storeRef.current!;
    // Solid: a tracked render effect is the store subscription; reads in one flush are consistent.
    const snapshots: Array<{ id: string | undefined; modal: boolean; disabled: boolean }> = [];
    render(() => {
      createRenderEffect(
        () => ({ id: store.state.id, modal: store.state.modal, disabled: store.state.disabled }),
        (snapshot) => {
          snapshots.push(snapshot);
        },
      );
      return null;
    });

    act(() => setFixtureProps({ id: 'second', modal: false, disabled: true }));

    expect(snapshots.some((snapshot) => snapshot.id === 'second' && snapshot.modal)).toBe(false);
    expect(snapshots.some((snapshot) => snapshot.id === 'first' && !snapshot.modal)).toBe(false);
    expect(snapshots.some((snapshot) => snapshot.id === 'second' && !snapshot.disabled)).toBe(
      false,
    );
    expect(snapshots.some((snapshot) => snapshot.id === 'first' && snapshot.disabled)).toBe(false);
    expect(snapshots).toContainEqual({ id: 'second', modal: false, disabled: true });
  });

  it('provides setOpen to a descendant ref callback on the first commit', () => {
    const handleOpenChange = vi.fn();
    let invoked = false;

    function CommandProbe() {
      const { setOpen } = useSelectRootContext();

      return (
        <div
          ref={(element) => {
            if (element && !invoked) {
              invoked = true;
              setOpen(true, createChangeEventDetails(REASONS.none));
            }
          }}
        />
      );
    }

    render(() => (
      <Select.Root onOpenChange={handleOpenChange}>
        <CommandProbe />
        <Select.Trigger />
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="alpha">alpha</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    expect(invoked).toBe(true);
    expect(handleOpenChange).toHaveBeenCalled();
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);
  });

  it('synchronizes an updated disabled prop after descendant ref callbacks', async () => {
    // Solid: a ref runs once, so the descendant's callback is a click dispatched in the same batch
    // as the prop update, before the flush, where React runs ref callbacks before the root's
    // layout effect syncs its props.
    const handleValueChange = vi.fn();
    const [disabled, setDisabled] = createSignal(false);
    let itemElement: HTMLElement | null = null;

    const { user } = await render(() => (
      <Select.Root defaultOpen disabled={disabled()} onValueChange={handleValueChange}>
        <Select.Trigger />
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item
                data-testid="item"
                value="alpha"
                ref={(element) => {
                  itemElement = element;
                }}
              >
                alpha
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    await user.hover(screen.getByTestId('item'));

    act(() => {
      setDisabled(true);
      itemElement!.click();
    });

    // The item receives the new state once the update flushes.
    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange.mock.calls[0][0]).toBe('alpha');
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
