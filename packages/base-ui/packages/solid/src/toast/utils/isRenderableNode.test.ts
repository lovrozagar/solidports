import type { JSX } from '@solidjs/web';
import { expect, describe, it } from 'vitest';
import { hasRenderableChildren, isRenderableNode } from './isRenderableNode';

// Solid: there is no `React.createElement`; an element is modelled as the props-carrying object
// `hasRenderableChildren` reads.
function createElement(children?: unknown): JSX.Element {
  return { props: children === undefined ? {} : { children } } as unknown as JSX.Element;
}

describe('isRenderableNode', () => {
  it('treats renderable primitives as content', () => {
    expect(isRenderableNode(0)).toBe(true);
    // Solid: `JSX.Element` does not include `bigint`.
    expect(isRenderableNode(0n as unknown as JSX.Element)).toBe(true);
    expect(isRenderableNode(Number.NaN)).toBe(true);
    expect(isRenderableNode('text')).toBe(true);
  });

  it('treats non-rendering values as empty', () => {
    expect(isRenderableNode(null)).toBe(false);
    expect(isRenderableNode(undefined)).toBe(false);
    expect(isRenderableNode(true)).toBe(false);
    expect(isRenderableNode(false)).toBe(false);
    expect(isRenderableNode('')).toBe(false);
  });

  it('recurses into arrays', () => {
    expect(isRenderableNode([])).toBe(false);
    expect(isRenderableNode([null, undefined, false])).toBe(false);
    expect(isRenderableNode([null, 0])).toBe(true);
    expect(isRenderableNode([[null]])).toBe(false);
    expect(isRenderableNode([[0]])).toBe(true);
  });
});

describe('hasRenderableChildren', () => {
  it('requires an element whose children are renderable', () => {
    expect(hasRenderableChildren(createElement('text'))).toBe(true);
    expect(hasRenderableChildren(createElement(0))).toBe(true);
    expect(hasRenderableChildren(createElement())).toBe(false);
    expect(hasRenderableChildren(createElement([]))).toBe(false);
    expect(hasRenderableChildren(null)).toBe(false);
    expect(hasRenderableChildren('text')).toBe(false);
  });
});
