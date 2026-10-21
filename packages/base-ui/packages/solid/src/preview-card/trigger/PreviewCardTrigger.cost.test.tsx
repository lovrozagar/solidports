/*
 * preview-card/roots-200 move across 20 (+1.7 ms from d4e50c03): the trigger's inline-rect props
 * were a memo over "is this trigger's card open", rebuilt as three new handlers whenever that read
 * re-ran, so every change of the store's active trigger re-spread the trigger's event props. The
 * handlers now read the open state when they fire: the props are built once per trigger, and a
 * trigger's open or active change rebuilds none of them.
 */
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';

const inlineRect = vi.hoisted(() => ({ builds: 0 }));
vi.mock('../../utils/popups/inlineRect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/popups/inlineRect')>();
  return {
    ...actual,
    getInlineRectTriggerProps: (...args: Parameters<typeof actual.getInlineRectTriggerProps>) => {
      inlineRect.builds += 1;
      return actual.getInlineRectTriggerProps(...args);
    },
  };
});

describe('<PreviewCard.Trigger /> cost', () => {
  const { render } = createRenderer();

  it('builds its inline-rect props once, whatever its card and the active trigger do', async () => {
    const [open, setOpen] = createSignal(false);
    const [triggerId, setTriggerId] = createSignal<string | null>(null);
    await render(() => (
      <PreviewCard.Root open={open()} triggerId={triggerId()}>
        <PreviewCard.Trigger id="a" href="#a">
          a
        </PreviewCard.Trigger>
        <PreviewCard.Trigger id="b" href="#b">
          b
        </PreviewCard.Trigger>
      </PreviewCard.Root>
    ));
    expect(inlineRect.builds).toBe(2);
    for (const [nextOpen, nextId] of [
      [false, 'a'],
      [true, 'a'],
      [true, 'b'],
      [false, 'b'],
      [false, null],
    ] as const) {
      setTriggerId(nextId);
      setOpen(nextOpen);
      flush();
    }
    expect(inlineRect.builds).toBe(2);
  });

  it('records the pointer while its card is closed and keeps it while the card is open', async () => {
    const [open, setOpen] = createSignal(false);
    await render(() => (
      <PreviewCard.Root open={open()} triggerId="a">
        <PreviewCard.Trigger id="a" href="#a">
          a
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>card</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));
    const trigger = screen.getByText('a');
    const rects = vi.spyOn(trigger, 'getClientRects');
    fireEvent.mouseMove(trigger, { clientX: 5, clientY: 5 });
    const whileClosed = rects.mock.calls.length;
    expect(whileClosed).toBeGreaterThan(0);
    setOpen(true);
    flush();
    fireEvent.mouseMove(trigger, { clientX: 6, clientY: 6 });
    expect(rects.mock.calls.length).toBe(whileClosed);
  });
});
