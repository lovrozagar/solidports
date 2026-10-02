import { render } from '@solidjs/testing-library';
import { untrack } from 'solid-js';
import { vi } from 'vitest';
import { useInteractions } from '../index';

describe('useInteractions', () => {
  it('correctly merges functions', () => {
    const firstInteractionOnClick = vi.fn();
    const secondInteractionOnClick = vi.fn();
    const secondInteractionOnKeyDown = vi.fn();
    const userOnClick = vi.fn();

    function App() {
      const interactions = useInteractions([
        { reference: { onClick: firstInteractionOnClick } },
        { reference: { onClick: secondInteractionOnClick, onKeyDown: secondInteractionOnKeyDown } },
      ]);

      // A component body is not a tracking scope; the live props view is read imperatively.
      const { onClick, onKeyDown } = untrack(() => {
        const { onClick: click, onKeyDown: keyDown } = interactions.getReferenceProps({
          onClick: userOnClick,
        });
        return { onClick: click, onKeyDown: keyDown };
      });

      // @ts-expect-error
      onClick();
      // @ts-expect-error
      onKeyDown();

      return null;
    }

    render(() => <App />);

    expect(firstInteractionOnClick).toHaveBeenCalledTimes(1);
    expect(secondInteractionOnClick).toHaveBeenCalledTimes(1);
    expect(userOnClick).toHaveBeenCalledTimes(1);
    expect(secondInteractionOnKeyDown).toHaveBeenCalledTimes(1);
  });

  it('does not error with undefined user supplied functions', () => {
    function App() {
      const interactions = useInteractions([{ reference: { onClick() {} } }]);
      expect(() =>
        untrack(() =>
          // @ts-expect-error
          interactions.getReferenceProps({ onClick: undefined }).onClick(),
        ),
      ).not.toThrowError();
      return null;
    }

    render(() => <App />);
  });

  it('does not break props that start with `on`', () => {
    function App() {
      const interactions = useInteractions([]);

      const props = interactions.getReferenceProps({
        // @ts-expect-error
        onlyShowVotes: true,
        onyx: () => {},
      });

      expect(untrack(() => props.onlyShowVotes)).toBe(true);
      expect(typeof untrack(() => props.onyx)).toBe('function');

      return null;
    }

    render(() => <App />);
  });

  it('does not break props that return values', () => {
    function App() {
      const interactions = useInteractions([]);

      const props = interactions.getReferenceProps({
        // @ts-expect-error
        onyx: () => 'returned value',
      });

      // @ts-expect-error
      expect(untrack(() => props.onyx())).toBe('returned value');

      return null;
    }

    render(() => <App />);
  });
});
