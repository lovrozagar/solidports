/*
 * Native parity for Menu.SubmenuTrigger with VoiceOver: a keyboard-opened submenu's trigger drops
 * `aria-expanded`, which removes a key from the submenu's trigger props while it is open. The
 * session in `test/menuSubmenuParity.tsx` must match on both paths. Kept in a separate file so the
 * module mock doesn't leak into the other suites.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRenderer } from '#test-utils';
import { submenuSession } from '../../../test/menuSubmenuParity';

vi.mock('../../utils/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../utils/platform')>('../../utils/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      screenReader: { ...actual.platform.screenReader, voiceOver: true },
    },
  };
});

describe('native parity: Menu.SubmenuTrigger with VoiceOver', () => {
  const { render } = createRenderer();

  it('renders the same trigger attributes, document and focus through a session', async () => {
    const native = await submenuSession(render as never, false);
    const keyboardOpen = native.filter((snapshot) => snapshot.open === 'click');
    // The VoiceOver branch ran: a keyboard-opened trigger has no `aria-expanded`.
    expect(keyboardOpen.some((snapshot) => !snapshot.click.includes('aria-expanded'))).toBe(true);
    expect(await submenuSession(render as never, true)).toEqual(native);
  });
});
