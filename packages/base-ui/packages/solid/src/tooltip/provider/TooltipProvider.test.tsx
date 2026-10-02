import { createRenderer, flushMicrotasks } from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { fireEvent, screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { createSignal, For } from 'solid-js';
import { act } from '#test-utils';
import { OPEN_DELAY } from '../utils/constants';

describe('<Tooltip.Provider />', () => {
  const { render, clock } = createRenderer();

  async function tick(ms: number) {
    clock.tick(ms);
    await flushMicrotasks();
  }

  describe('prop: delay', () => {
    clock.withFakeTimers();

    it('waits for the delay before showing the tooltip', async () => {
      render(() => (
        <Tooltip.Provider delay={10_000}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      expect(screen.queryByText('Content')).to.equal(null);

      clock.tick(1_000);

      expect(screen.queryByText('Content')).to.equal(null);

      clock.tick(9_000);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).not.to.equal(null);
    });

    it('respects delay=0', async () => {
      render(() => (
        <Tooltip.Provider delay={0}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(0);

      expect(screen.queryByText('Content')).not.to.equal(null);
    });

    it('respects trigger delay prop over provider delay prop', async () => {
      render(() => (
        <Tooltip.Provider delay={10}>
          <Tooltip.Root>
            <Tooltip.Trigger delay={100} />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      expect(screen.queryByText('Content')).to.equal(null);

      clock.tick(99);

      expect(screen.queryByText('Content')).to.equal(null);

      clock.tick(1);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).not.to.equal(null);
    });
  });

  describe('prop: closeDelay', () => {
    clock.withFakeTimers();

    it('waits for the closeDelay before hiding the tooltip', async () => {
      render(() => (
        <Tooltip.Provider closeDelay={400}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(OPEN_DELAY);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).not.to.equal(null);

      fireEvent.mouseLeave(trigger);

      clock.tick(300);

      expect(screen.queryByText('Content')).not.to.equal(null);

      clock.tick(300);

      expect(screen.queryByText('Content')).to.equal(null);
    });

    it('uses the latest closeDelay after the prop updates', async () => {
      const [closeDelay, setCloseDelay] = createSignal(400);

      render(() => (
        <Tooltip.Provider closeDelay={closeDelay()}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      ));

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      await flushMicrotasks();

      await tick(OPEN_DELAY);

      expect(screen.queryByText('Content')).not.to.equal(null);

      act(() => setCloseDelay(1000));

      fireEvent.mouseLeave(trigger);

      await flushMicrotasks();

      await tick(999);

      expect(screen.queryByText('Content')).not.to.equal(null);

      await tick(1);

      expect(screen.queryByText('Content')).to.equal(null);
    });
  });

  describe('prop: timeout', () => {
    clock.withFakeTimers();

    function TwoTooltips(props: {
      timeout: number;
      providerDelay?: number;
      triggerDelay?: number;
    }) {
      return (
        <Tooltip.Provider delay={props.providerDelay ?? 100} timeout={props.timeout}>
          <For each={['One', 'Two']}>
            {(name) => (
              <Tooltip.Root>
                <Tooltip.Trigger delay={props.triggerDelay}>{name}</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup>{`Content ${name}`}</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </For>
        </Tooltip.Provider>
      );
    }

    it('opens an adjacent tooltip instantly while the group is active', async () => {
      render(() => <TwoTooltips timeout={400} />);

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      fireEvent.mouseEnter(first);
      fireEvent.mouseMove(first);
      await flushMicrotasks();
      await tick(100);

      expect(screen.queryByText('Content One')).not.to.equal(null);

      fireEvent.mouseLeave(first);
      fireEvent.mouseEnter(second);
      fireEvent.mouseMove(second);
      await flushMicrotasks();
      await tick(0);

      expect(screen.queryByText('Content Two')).not.to.equal(null);
      expect(screen.queryByText('Content One')).to.equal(null);
    });

    it('respects a trigger delay over delay=0 outside the instant phase', async () => {
      render(() => <TwoTooltips timeout={400} providerDelay={0} triggerDelay={100} />);

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      fireEvent.mouseEnter(first);
      fireEvent.mouseMove(first);
      await flushMicrotasks();

      await tick(99);
      expect(screen.queryByText('Content One')).to.equal(null);

      await tick(1);
      expect(screen.queryByText('Content One')).not.to.equal(null);

      fireEvent.mouseLeave(first);
      fireEvent.mouseEnter(second);
      fireEvent.mouseMove(second);
      await flushMicrotasks();
      await tick(0);

      expect(screen.queryByText('Content Two')).not.to.equal(null);
      expect(screen.queryByText('Content One')).to.equal(null);

      fireEvent.mouseLeave(second);
      await flushMicrotasks();
      await tick(400);

      fireEvent.mouseEnter(first);
      fireEvent.mouseMove(first);
      await flushMicrotasks();

      await tick(99);
      expect(screen.queryByText('Content One')).to.equal(null);

      await tick(1);
      expect(screen.queryByText('Content One')).not.to.equal(null);
    });

    it('requires the full delay again once the timeout elapses', async () => {
      render(() => <TwoTooltips timeout={400} />);

      const first = screen.getByRole('button', { name: 'One' });
      const second = screen.getByRole('button', { name: 'Two' });

      fireEvent.mouseEnter(first);
      fireEvent.mouseMove(first);
      await flushMicrotasks();
      await tick(100);

      expect(screen.queryByText('Content One')).not.to.equal(null);

      fireEvent.mouseLeave(first);
      await flushMicrotasks();
      await tick(400);

      fireEvent.mouseEnter(second);
      fireEvent.mouseMove(second);
      await flushMicrotasks();

      expect(screen.queryByText('Content Two')).to.equal(null);

      await tick(100);

      expect(screen.queryByText('Content Two')).not.to.equal(null);
    });
  });
});
