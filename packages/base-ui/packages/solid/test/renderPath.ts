import { expect } from 'vitest';
import { renderPathOf } from '../src/utils/renderPath';

const describeElement = (el: Element) => el.outerHTML.slice(0, 120);

/** Asserts that each element was rendered by a part on the native path. */
export function expectNativePath(...elements: Element[]): void {
  expect(elements.length, 'expectNativePath needs an element').toBeGreaterThan(0);
  for (const el of elements) {
    expect(renderPathOf(el), `${describeElement(el)} took the native path`).toBe('native');
  }
}

/** Asserts that each element was rendered by a part on the slow path (`useRenderElement`). */
export function expectSlowPath(...elements: Element[]): void {
  expect(elements.length, 'expectSlowPath needs an element').toBeGreaterThan(0);
  for (const el of elements) {
    expect(renderPathOf(el), `${describeElement(el)} took the slow path`).toBe('slow');
  }
}

/** Asserts that no part under `container` (itself included) took the slow path. */
export function expectNoSlowPath(container: Element): void {
  const slow = [container, ...container.querySelectorAll('*')].filter(
    (el) => renderPathOf(el) === 'slow',
  );
  expect(slow.map(describeElement), 'parts on the slow path').toEqual([]);
}
