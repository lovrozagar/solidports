import { expect, describe, it } from 'vitest';
import { getReactElementRef } from './getReactElementRef';

// Solid: a render element is a `{ component, ...props }` config rather than a React element.
describe('getReactElementRef', () => {
  it('returns null when not provided a React element', () => {
    expect(getReactElementRef(false)).toBe(null);
    expect(getReactElementRef(undefined)).toBe(null);
    expect(getReactElementRef(1)).toBe(null);

    const children = [{ component: 'div' }, { component: 'div' }];
    expect(getReactElementRef(children)).toBe(null);
  });

  it('returns the ref of a React element', () => {
    const ref = { current: null };
    const element = { component: 'div', ref };

    expect(getReactElementRef(element)).toBe(ref);
  });

  it('returns null for a fragment', () => {
    const element = (
      <>
        <p>Hello</p>
        <p>Hello</p>
      </>
    );

    expect(getReactElementRef(element)).toBe(null);
  });

  it('returns null for an element without a ref', () => {
    const element = { component: 'div' };

    expect(getReactElementRef(element)).toBe(null);
  });
});
