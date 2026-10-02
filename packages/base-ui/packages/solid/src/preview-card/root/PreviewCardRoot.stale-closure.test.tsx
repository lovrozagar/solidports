import { act, createRenderer, flushMicrotasks } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_DELAY } from '../utils/constants';

describe('PreviewCardRoot stale-closure regression', () => {
  const { render, clock } = createRenderer();

  clock.withFakeTimers();

  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('invokes the latest onOpenChange after prop swap', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const [cb, setCb] = createSignal<(open: boolean) => void>(() => cb1);

    render(() => (
      <PreviewCard.Root onOpenChange={cb()}>
        <PreviewCard.Trigger href="#" data-testid="trigger">
          Link
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner data-testid="positioner">
            <PreviewCard.Popup>Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));

    const trigger = screen.getByTestId('trigger');

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);
    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('positioner')).not.toBeNull();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenLastCalledWith(true, expect.anything());

    act(() => setCb(() => cb2));

    fireEvent.mouseLeave(trigger);
    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenLastCalledWith(false, expect.anything());
    expect(cb1).toHaveBeenCalledTimes(1);
  });
});
