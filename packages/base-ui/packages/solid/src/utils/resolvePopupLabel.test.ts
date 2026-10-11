import { describe, expect, it } from 'vitest';
import { resolvePopupLabel } from './resolvePopupLabel';

describe('resolvePopupLabel', () => {
  it('prefers an aria-label on the part, then on the rendered element', () => {
    expect(resolvePopupLabel({ 'aria-label': 'Part' }, null, 'trigger')).toBeUndefined();
    expect(
      resolvePopupLabel({ 'aria-label': 'Part', render: { 'aria-label': 'Rendered' } }, null, null),
    ).toBeUndefined();
  });

  it('uses aria-labelledby from the part or the rendered element', () => {
    expect(resolvePopupLabel({ 'aria-labelledby': 'part-label' }, null, 'trigger')).toBe(
      'part-label',
    );
    expect(resolvePopupLabel({ render: { 'aria-labelledby': 'rendered-label' } }, null, null)).toBe(
      'rendered-label',
    );
  });

  it('falls back to the trigger element id, then the registered trigger id', () => {
    const trigger = document.createElement('button');
    trigger.id = 'live-trigger';
    expect(resolvePopupLabel({}, trigger, 'registered')).toBe('live-trigger');

    trigger.id = '';
    expect(resolvePopupLabel({}, trigger, 'registered')).toBeUndefined();
    expect(resolvePopupLabel({}, null, 'registered')).toBe('registered');
    expect(resolvePopupLabel({}, null, '')).toBeUndefined();
  });

  it('ignores a rendered node and a render object without label props', () => {
    expect(resolvePopupLabel({ render: document.createTextNode('x') }, null, 'trigger')).toBe(
      'trigger',
    );
    expect(resolvePopupLabel({ render: {} }, null, null)).toBeUndefined();
  });
});
