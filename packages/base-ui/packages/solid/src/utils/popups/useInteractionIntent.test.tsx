/*
 * A trigger's deferred interactions are created on its first intent, caught by a capture listener
 * on the trigger's root. Inside a closed shadow root the root is the shadow root: a listener on the
 * document sees an event's composed path stop at the shadow host, so the trigger never saw its
 * intent and its first press or hover did nothing. Each root keeps its listeners only while a
 * trigger in it is still waiting, which the tests read from the root's own listener calls.
 */
import { createSignal, flush, Show } from 'solid-js';
import { Portal } from '@solidjs/web';
import { fireEvent } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Popover } from '@solidports/base-ui/popover';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { createRenderer, flushMicrotasks } from '#test-utils';

const press = async (trigger: HTMLElement) => {
  fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  flush();
  await flushMicrotasks();
};

describe('deferred trigger interactions inside a shadow root', () => {
  const { render } = createRenderer();
  let host: HTMLElement | undefined;

  afterEach(() => {
    host?.remove();
    host = undefined;
  });

  function shadowContainer(mode: ShadowRootMode) {
    host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode });
    const container = shadowRoot.appendChild(document.createElement('div'));
    return { shadowRoot, container, listening: watchListeners(shadowRoot) };
  }

  /** Whether `root` holds an intent listener (`pointerdown` is one), counted as added and removed. */
  function watchListeners(root: Node) {
    let pointerdown = 0;
    const add = root.addEventListener.bind(root);
    const remove = root.removeEventListener.bind(root);
    root.addEventListener = (
      type: string,
      ...rest: [EventListenerOrEventListenerObject, AddEventListenerOptions?]
    ) => {
      if (type === 'pointerdown') {
        pointerdown += 1;
      }
      add(type, ...rest);
    };
    root.removeEventListener = (
      type: string,
      ...rest: [EventListenerOrEventListenerObject, EventListenerOptions?]
    ) => {
      if (type === 'pointerdown') {
        pointerdown -= 1;
      }
      remove(type, ...rest);
    };
    return () => pointerdown > 0;
  }

  describe.for(['closed', 'open'] as const)('a %s shadow root', (mode) => {
    it('opens a popover on the first click of its trigger', async () => {
      const { shadowRoot, container } = shadowContainer(mode);
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
      await press(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('opens a tooltip on the first hover of its trigger', async () => {
      const { shadowRoot, container } = shadowContainer(mode);
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

  it('keeps no listeners on a shadow root once its waiting trigger unmounts', () => {
    const { container, listening } = shadowContainer('closed');
    const view = render(
      () => (
        <Popover.Root>
          <Popover.Trigger>Open</Popover.Trigger>
        </Popover.Root>
      ),
      {},
      { container },
    );
    flush();
    expect(listening()).toBe(true);
    view.unmount();
    flush();
    expect(listening()).toBe(false);
  });

  it('keeps no listeners on a root once its trigger has its interactions', async () => {
    const { shadowRoot, container, listening } = shadowContainer('closed');
    render(
      () => (
        <Popover.Root>
          <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
        </Popover.Root>
      ),
      {},
      { container },
    );
    flush();
    expect(listening()).toBe(true);
    await press(shadowRoot.querySelector('[data-testid="trigger"]') as HTMLElement);
    expect(listening()).toBe(false);
  });

  it('listens on the new root when a re-render moves the trigger into a shadow root', async () => {
    const { shadowRoot, container: shadowMount, listening } = shadowContainer('closed');
    const [inShadow, setInShadow] = createSignal(false);
    render(() => (
      <Popover.Root>
        <Show when={inShadow()} fallback={<Popover.Trigger>Outside</Popover.Trigger>}>
          <Portal mount={shadowMount}>
            <Popover.Trigger data-testid="trigger">Inside</Popover.Trigger>
          </Portal>
        </Show>
      </Popover.Root>
    ));
    flush();
    expect(listening()).toBe(false);
    setInShadow(true);
    flush();
    expect(listening()).toBe(true);
    const trigger = shadowRoot.querySelector('[data-testid="trigger"]') as HTMLElement;
    await press(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
