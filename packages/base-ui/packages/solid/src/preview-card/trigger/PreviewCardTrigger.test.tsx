import { act, createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { For } from 'solid-js';
import { expect, vi, describe, it } from 'vitest';

describe('<PreviewCard.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(PreviewCard.Trigger, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render: (node, props) => render(() => <PreviewCard.Root open>{node(props!)}</PreviewCard.Root>),
  }));

  // Solid: D32's class guard. Each trigger builds its hover and focus interactions on its first
  // intent, so two cards on one page must each open from their own first contact.
  describe('two preview cards on one page', () => {
    function twoCards() {
      return render(() => (
        <div>
          <For each={['first', 'second']}>
            {(name) => (
              <PreviewCard.Root>
                <PreviewCard.Trigger href="#" data-testid={`${name}-trigger`} delay={0}>
                  {name}
                </PreviewCard.Trigger>
                <PreviewCard.Portal>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup>{`${name} card`}</PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </PreviewCard.Root>
            )}
          </For>
        </div>
      ));
    }

    it('opens the second on hover when its first intent is the pointer entering', async () => {
      twoCards();
      const second = screen.getByTestId('second-trigger');
      fireEvent.pointerEnter(second, { pointerType: 'mouse' });
      fireEvent.mouseEnter(second);
      fireEvent.mouseMove(second, { movementX: 1, movementY: 1 });
      await flushMicrotasks();
      await waitFor(() => {
        expect(second).toHaveAttribute('data-popup-open');
      });
      expect(screen.getByTestId('first-trigger')).not.toHaveAttribute('data-popup-open');
    });

    it('opens the second on focus after the first opened on focus', async () => {
      twoCards();
      const first = screen.getByTestId('first-trigger');
      const second = screen.getByTestId('second-trigger');
      await act(async () => first.focus());
      await waitFor(() => {
        expect(first).toHaveAttribute('data-popup-open');
      });
      await act(async () => second.focus());
      await waitFor(() => {
        expect(second).toHaveAttribute('data-popup-open');
      });
    });
  });

  it('throws without PreviewCard.Root or a handle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <PreviewCard.Trigger />)).toThrow(
        'Base UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
