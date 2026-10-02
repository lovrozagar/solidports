import { createRenderer, flushMicrotasks } from '#test-utils';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { CompositeItem } from '../item/CompositeItem';
import { CompositeRoot } from './CompositeRoot';
import { useCompositeRoot } from './useCompositeRoot';

/* Bug 4 regression: relayKeyboardEvent was `props.onKeyDown!` (non-null assert
 * on an optional property). Post-fix extracts a guaranteed-defined `onKeyDown`
 * constant and assigns it to both props.onKeyDown and relayKeyboardEvent. */

describe('useCompositeRoot — relayKeyboardEvent regression', () => {
  it('relayKeyboardEvent is always defined and does not throw on a fake event', () => {
    let relay: ReturnType<typeof useCompositeRoot>['relayKeyboardEvent'] | undefined;

    function Probe() {
      const root = useCompositeRoot({
        orientation: 'horizontal',
        loopFocus: true,
        direction: 'ltr',
      });
      relay = root.relayKeyboardEvent;
      return null;
    }

    render(() => <Probe />);

    expect(relay).toBeDefined();
    expect(typeof relay).toBe('function');

    /* Null rootRef triggers early return — must not throw.
     * Use a real KeyboardEvent so getModifierState() is available. */
    const fakeEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    /* Cast to any to avoid Solid's EventHandler target constraint on the fake event. */
    expect(() => relay!(fakeEvent as any)).not.toThrow();
  });
});

describe('CompositeRoot — arrow navigation without external onKeyDown', () => {
  const { render: createRender } = createRenderer();

  /* Regression target: the hook must not non-null-assert from a possibly-undefined
   * source — relayKeyboardEvent is always the same extracted constant. */
  it('dispatches ArrowRight to move focus to next item without any onKeyDown prop', async () => {
    createRender(() => (
      <CompositeRoot orientation="horizontal" data-testid="root">
        <CompositeItem data-testid="a">A</CompositeItem>
        <CompositeItem data-testid="b">B</CompositeItem>
      </CompositeRoot>
    ));

    const itemA = screen.getByTestId('a');
    const itemB = screen.getByTestId('b');

    itemA.focus();

    fireEvent.keyDown(itemA, { key: 'ArrowRight' });
    await flushMicrotasks();

    await waitFor(() => {
      expect(itemB).toHaveFocus();
    });
  });
});
