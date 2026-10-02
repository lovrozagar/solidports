import { expect, describe, it } from 'vitest';
import { createRenderer } from '#test-utils';
import { screen } from '@solidjs/testing-library';
import {
  INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY,
  useInitialLiveRegionTextMutation,
} from './useInitialLiveRegionTextMutation';

describe('useInitialLiveRegionTextMutation', () => {
  const { render } = createRenderer();

  it('does nothing when its ref is not attached', () => {
    function Unattached() {
      useInitialLiveRegionTextMutation();
      return <div data-testid="status">Status</div>;
    }

    render(Unattached);

    expect(screen.getByTestId('status')).toHaveTextContent('Status');
  });

  it('skips empty text nodes when finding the announcement text', () => {
    const text = document.createTextNode('Status');
    const empty = document.createTextNode('');

    function Status() {
      const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();

      // Solid: the ref callback runs before the hook's mount effect, as React's layout effect does.
      return (
        <div
          ref={(el) => {
            ref.current = el;
            el.append(text, empty);
          }}
          data-testid="status"
        />
      );
    }

    render(Status);

    expect(text.data).toBe('Status⁠');
    expect(empty.data).toBe('');
  });

  describe('with fake timers', () => {
    const { render: renderWithFakeTimers, clock } = createRenderer({
      clockOptions: { shouldAdvanceTime: true },
    });

    clock.withFakeTimers();

    it('does not overwrite text that changes before the reset', () => {
      function Status() {
        const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();
        return (
          <div
            ref={(el) => {
              ref.current = el;
            }}
            data-testid="status"
          >
            Status
          </div>
        );
      }

      renderWithFakeTimers(Status);
      const status = screen.getByTestId('status');
      status.firstChild!.nodeValue = 'Updated';

      clock.tick(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(status).toHaveTextContent('Updated');
    });
  });
});
