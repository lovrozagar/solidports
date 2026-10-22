/*
 * A trigger's deferred interactions are created on its first intent, caught by a capture listener
 * on the trigger's root. Inside a closed shadow root the root is the shadow root: a listener on the
 * document sees an event's composed path stop at the shadow host, so the trigger never saw its
 * intent and its first press or hover did nothing.
 */
import { flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Popover } from '@solidports/base-ui/popover';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { createRenderer, flushMicrotasks } from '#test-utils';

describe('deferred trigger interactions inside a closed shadow root', () => {
  const { render } = createRenderer();
  let host: HTMLElement | undefined;

  afterEach(() => {
    host?.remove();
    host = undefined;
  });

  function shadowContainer() {
    host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'closed' });
    const container = shadowRoot.appendChild(document.createElement('div'));
    return { shadowRoot, container };
  }

  it('opens a popover on the first click of its trigger', async () => {
    const { shadowRoot, container } = shadowContainer();
    render(
      () => (
        <Popover.Root>
          <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
        </Popover.Root>
      ),
      {},
      { container },
    );
    const trigger = shadowRoot.querySelector('[data-testid="trigger"]') as HTMLElement;
    fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    flush();
    await flushMicrotasks();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens a tooltip on the first hover of its trigger', async () => {
    const { shadowRoot, container } = shadowContainer();
    render(
      () => (
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="trigger" delay={0}>
            Tip
          </Tooltip.Trigger>
        </Tooltip.Root>
      ),
      {},
      { container },
    );
    const trigger = shadowRoot.querySelector('[data-testid="trigger"]') as HTMLElement;
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger, { movementX: 1, movementY: 1 });
    flush();
    await flushMicrotasks();
    expect(trigger).toHaveAttribute('data-popup-open');
  });
});
