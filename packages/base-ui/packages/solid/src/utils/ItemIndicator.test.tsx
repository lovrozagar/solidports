import { createSignal, flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { waitFor } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';
import { ItemIndicator } from './ItemIndicator';

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe('ItemIndicator', () => {
  const { render } = createRenderer();

  it('renders the check only while selected, unless the indicator is kept mounted', async () => {
    const [selected, setSelected] = createSignal(true);
    const [keepMounted, setKeepMounted] = createSignal(false);

    render(() => (
      <ItemIndicator
        data-testid="mark"
        class="mark"
        selected={selected()}
        keepMounted={keepMounted() ? true : undefined}
      />
    ));

    expect(document.querySelector('[data-testid="mark"]')?.textContent).toBe('✔️');
    expect(document.querySelector('[data-testid="mark"]')).toHaveAttribute('aria-hidden', 'true');

    setKeepMounted(true);
    flush();
    setSelected(false);
    setSelected(true);
    flush();
    await Promise.resolve();
    setSelected(false);
    flush();
    await Promise.resolve();
    flush();
    expect(document.querySelector('[data-testid="mark"]')).not.toBe(null);
  });

  it('ignores a completion that arrives after the item is selected again', async () => {
    const previousAnimations = globalThis.BASE_UI_ANIMATIONS_DISABLED;
    const previousGetAnimations = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'getAnimations',
    );
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
    let resolveFinished = () => {};
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    let animationReads = 0;
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value() {
        animationReads += 1;
        return [
          {
            finished,
            effect: { getTiming: () => ({ duration: 1, iterations: 1 }) },
          },
        ];
      },
    });

    try {
      // `version` reruns the exit effect. `selectedNow` is what the late callback reads, so the
      // callback can observe a selection that did not schedule a new effect of its own.
      let selectedNow = true;
      const [version, setVersion] = createSignal(0);
      render(() => (
        <ItemIndicator data-testid="mark" keepMounted selected={(version(), selectedNow)} />
      ));
      flush();

      selectedNow = false;
      setVersion(1);
      flush();
      // The animations are read on the next animation frame.
      await waitFor(() => {
        expect(animationReads).toBeGreaterThan(0);
      });

      selectedNow = true;
      resolveFinished();
      await finished;
      await nextFrame();
      await nextFrame();
      flush();
      expect(document.querySelector('[data-testid="mark"]')).not.toBe(null);
    } finally {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimations;
      if (previousGetAnimations) {
        Object.defineProperty(Element.prototype, 'getAnimations', previousGetAnimations);
      } else {
        delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
      }
    }
  });
});
