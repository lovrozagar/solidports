/*
 * A frame of a code block highlights while it is in view: each frame reports its own visibility,
 * so a collapsed frame out of view leaves the frames in view highlighted.
 */
import { createSignal, flush } from 'solid-js';
import type { Element as HastElement, Root as HastRoot } from 'hast';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderClient } from '../__fixtures__/hydration';
import { Pre } from './Pre';

/** A frame of one highlighted line. */
function frame(frameType: string | undefined, line: number, keyword: string): HastElement {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['frame'], ...(frameType ? { dataFrameType: frameType } : {}) },
    children: [
      {
        type: 'element',
        tagName: 'span',
        properties: { className: ['line'], dataLn: line },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['pl-k'] },
            children: [{ type: 'text', value: keyword }],
          },
        ],
      },
      { type: 'text', value: '\n' },
    ],
  };
}

const source: HastRoot = {
  type: 'root',
  children: [frame('focus', 1, 'import'), frame(undefined, 2, 'export')],
  data: { totalLines: 2, focusedLines: 1 } as HastRoot['data'],
};

/** The IntersectionObserver jsdom lacks, reporting what a test says is in view. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly targets = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
  }

  takeRecords() {
    return [];
  }

  report(target: Element, visible: boolean) {
    const size = visible ? 20 : 0;
    const entry = {
      target,
      isIntersecting: visible,
      intersectionRect: { width: size, height: size },
    } as unknown as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
}

let originalObserver: typeof IntersectionObserver;
let cleanup: (() => void) | undefined;
beforeEach(() => {
  originalObserver = globalThis.IntersectionObserver;
  FakeIntersectionObserver.instances = [];
  globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  globalThis.IntersectionObserver = originalObserver;
});

const frames = (container: Element) => Array.from(container.querySelectorAll('code > .frame'));
const isHighlighted = (element: Element) => element.querySelector('.pl-k') !== null;

describe('Pre', () => {
  it('highlights each frame by its own visibility', () => {
    const client = renderClient(() => <Pre shouldHighlight>{source}</Pre>);
    cleanup = client.dispose;
    const [first, second] = frames(client.container);
    const observer = FakeIntersectionObserver.instances.at(-1)!;
    expect(isHighlighted(first)).toBe(true);
    expect(isHighlighted(second)).toBe(false);

    // The second frame, collapsed out of view, reports a zero-area rect.
    observer.report(second, false);
    flush();
    expect(isHighlighted(first)).toBe(true);

    observer.report(second, true);
    flush();
    expect(isHighlighted(frames(client.container)[1])).toBe(true);
    expect(isHighlighted(frames(client.container)[0])).toBe(true);
  });

  it('stops observing the frames a new source replaces', () => {
    const [code, setCode] = createSignal<HastRoot>(source);
    const client = renderClient(() => <Pre shouldHighlight>{code()}</Pre>);
    cleanup = client.dispose;
    const observer = FakeIntersectionObserver.instances.at(-1)!;
    const before = frames(client.container);
    expect([...observer.targets]).toEqual(before);

    setCode({ ...source, children: [frame('focus', 1, 'const')] });
    flush();
    const after = frames(client.container);
    expect(after).toHaveLength(1);
    expect([...observer.targets]).toEqual(after);
  });
});
