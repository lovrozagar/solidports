import { describe, expect, it } from 'vitest';
import { getHighlightReason } from './getHighlightReason';
import { REASONS } from './reasons';

describe('getHighlightReason', () => {
  it('reports none when the highlight has no event', () => {
    expect(getHighlightReason(undefined)).toBe(REASONS.none);
    expect(getHighlightReason(null as unknown as undefined)).toBe(REASONS.none);
  });

  it('reports keyboard for key events and pointer for mouse or pointer events', () => {
    expect(getHighlightReason(new KeyboardEvent('keydown'))).toBe(REASONS.keyboard);
    expect(getHighlightReason(new KeyboardEvent('keyup'))).toBe(REASONS.keyboard);
    expect(getHighlightReason(new MouseEvent('mousedown'))).toBe(REASONS.pointer);
    expect(getHighlightReason(new PointerEvent('pointermove'))).toBe(REASONS.pointer);
  });

  it('reports none for any other event', () => {
    expect(getHighlightReason(new Event('click'))).toBe(REASONS.none);
  });
});
