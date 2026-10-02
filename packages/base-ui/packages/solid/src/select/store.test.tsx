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
    const [fixtureProps, setFixtureProps] = createSignal({ id: 'first', modal: true });

    render(() => (
      <Select.Root id={fixtureProps().id} modal={fixtureProps().modal}>
        <StoreProbe storeRef={storeRef} />
        <Select.Trigger />
      </Select.Root>
    ));

    const store = storeRef.current!;
    // Solid: a tracked render effect is the store subscription; reads in one flush are consistent.
    const snapshots: Array<{ id: string | undefined; modal: boolean }> = [];
    render(() => {
      createRenderEffect(
        () => ({ id: store.state.id, modal: store.state.modal }),
        (snapshot) => {
          snapshots.push(snapshot);
        },
      );
      return null;
    });

    act(() => setFixtureProps({ id: 'second', modal: false }));

    expect(snapshots.some((snapshot) => snapshot.id === 'second' && snapshot.modal)).toBe(false);
    expect(snapshots.some((snapshot) => snapshot.id === 'first' && !snapshot.modal)).toBe(false);
    expect(snapshots).toContainEqual({ id: 'second', modal: false });
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

  it('makes an updated disabled prop available to item ref callbacks', async () => {
    const handleValueChange = vi.fn();
    const [disabled, setDisabled] = createSignal(false);

    const { user } = render(() => (
      <Select.Root defaultOpen disabled={disabled()} onValueChange={handleValueChange}>
        <Select.Trigger />
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item data-testid="item" value="alpha">
                alpha
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    await user.hover(screen.getByTestId('item'));

    // Solid: refs run once, so the click React issues from a re-invoked ref callback is issued
    // right after the update instead.
    act(() => setDisabled(true));
    act(() => screen.getByTestId('item').click());

    expect(handleValueChange).not.toHaveBeenCalled();
  });
});
