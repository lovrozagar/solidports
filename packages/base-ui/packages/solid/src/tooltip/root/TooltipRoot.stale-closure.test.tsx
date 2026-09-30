import { createRenderer, flushMicrotasks } from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_DELAY } from '../utils/constants';

describe('TooltipRoot stale-closure regression', () => {
  const { render, clock } = createRenderer();

  clock.withFakeTimers();

  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('invokes the latest onOpenChange after prop swap', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const [cb, setCb] = createSignal<(open: boolean) => void>(cb1);

    render(() => (
      <Tooltip.Root onOpenChange={cb()}>
        <Tooltip.Trigger data-testid="trigger">Hover me</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner data-testid="positioner">
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const trigger = screen.getByTestId('trigger');

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);
    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('positioner')).not.toBeNull();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenLastCalledWith(true, expect.anything());

    setCb(() => cb2);

    fireEvent.mouseLeave(trigger);
    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenLastCalledWith(false, expect.anything());
    expect(cb1).toHaveBeenCalledTimes(1);
  });
});
