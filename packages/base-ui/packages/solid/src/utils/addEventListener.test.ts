import { expect, vi, describe, it } from 'vitest';
import { addEventListener } from './addEventListener';

describe('addEventListener', () => {
  it('adds the listener and returns an unsubscribe function', () => {
    const target = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const listener = vi.fn();
    const options = { capture: true, passive: false };

    const unsubscribe = addEventListener(target, 'click', listener, options);

    // Solid: the listener is registered through an untracked wrapper (see addEventListener).
    expect(target.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), options);
    const registered = target.addEventListener.mock.calls[0][1] as (event: Event) => void;
    const event = new Event('click');
    registered(event);
    expect(listener).toHaveBeenCalledWith(event);

    unsubscribe();

    expect(target.removeEventListener).toHaveBeenCalledWith('click', registered, options);
  });
});
