import { createSignal } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { createRenderer } from '#test-utils';
import { resolveRenderedId, useRenderedId } from './resolveRenderedId';

describe('resolveRenderedId', () => {
  it('reads an id on the rendered element ahead of the part id and the fallback', () => {
    expect(resolveRenderedId({ id: 'part', render: { id: 'rendered' } }, 'fallback')).toBe(
      'rendered',
    );
    expect(resolveRenderedId({ render: { id: '' } }, 'fallback')).toBe('');
    expect(resolveRenderedId({ render: { id: undefined } }, 'fallback')).toBe('');
  });

  it('ignores a rendered node or an element that does not set id', () => {
    expect(resolveRenderedId({ id: 'part', render: document.createTextNode('x') }, 'fallback')).toBe(
      'part',
    );
    expect(resolveRenderedId({ render: {} }, 'fallback')).toBe('fallback');
    expect(resolveRenderedId({ render: null }, undefined)).toBeUndefined();
  });
});

describe('useRenderedId', () => {
  const { render } = createRenderer();

  it('publishes only an id that overrides the generated fallback', () => {
    const published: Array<string | undefined> = [];
    const [fallback, setFallback] = createSignal('generated');

    function Probe() {
      const [id, ref] = useRenderedId({ id: 'custom' }, fallback, (next) => published.push(next));
      ref(document.createElement('div'));
      return <span data-testid="id">{id()}</span>;
    }

    render(Probe);
    expect(document.querySelector('[data-testid="id"]')?.textContent).toBe('custom');
    expect(published).toEqual(['custom']);

    published.length = 0;
    function Generated() {
      const [, ref] = useRenderedId({}, fallback, (next) => published.push(next));
      ref(document.createElement('div'));
      ref(null);
      return null;
    }
    render(Generated);
    expect(published).toEqual([undefined, undefined]);

    setFallback('next');
  });

  it('does nothing when the owner did not ask to record the id', () => {
    function Probe() {
      const [, ref] = useRenderedId({ id: 'custom' }, 'generated', undefined);
      ref(document.createElement('div'));
      ref(undefined);
      return null;
    }
    expect(() => render(Probe)).not.toThrow();
  });
});
