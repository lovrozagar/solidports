/*
 * Native parity for Menu.SubmenuTrigger (D32's sweep): the session in `test/menuSubmenuParity.tsx`
 * renders the same trigger attributes, document and focus on the native and the slow path at each
 * point (closed, hover-open, click-open, keyboard-open, closed again).
 */
import { describe, expect, it } from 'vitest';
import { createRenderer } from '#test-utils';
import { submenuSession } from '../../../test/menuSubmenuParity';

describe('native parity: Menu.SubmenuTrigger', () => {
  const { render } = createRenderer();

  it('renders the same trigger attributes, document and focus through a session', async () => {
    const native = await submenuSession(render as never, false);
    expect(await submenuSession(render as never, true)).toEqual(native);
  });
});
