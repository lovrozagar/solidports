import { expect, describe, it } from 'vitest';
import { resolvePopupLabel } from './resolvePopupLabel';

describe('resolvePopupLabel', () => {
  it('falls back to the trigger id', () => {
    expect(resolvePopupLabel({}, null, 'trigger')).toBe('trigger');
  });

  it("uses a render element's own label instead of the trigger", () => {
    expect(
      resolvePopupLabel(
        { render: { component: 'div', 'aria-label': 'Commands' } },
        null,
        'trigger',
      ),
    ).toBe(undefined);
  });

  // Solid: render elements are plain config objects; there are no Server Component lazy wrappers.
  it.skip("reads a server-created render element's label", () => {});
});
