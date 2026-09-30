import { createRenderer } from '#test-utils';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

/* Pin: jsdom does not expose PointerEvent as a global.
 * CheckboxRoot.tsx calls `new PointerEvent('click', ...)` inside the click
 * handler, causing ReferenceError and cascading ~58 failures across Checkbox,
 * Switch, and RadioGroup suites.
 *
 * Fix belongs in /workerc:fix (polyfill PointerEvent in vitest.setup.ts OR
 * refactor CheckboxRoot to guard with `typeof PointerEvent !== 'undefined'`).
 * This test is skipped until the fix lands; remove .skip when polyfill is in. */
describe('CheckboxRoot PointerEvent shim pin', () => {
  const { render } = createRenderer();

  it.skip('click does not throw ReferenceError in jsdom', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user } = render(() => <Checkbox.Root data-testid="cb" />);
    await expect(user.click(screen.getByTestId('cb'))).resolves.not.toThrow();
    errSpy.mockRestore();
  });
});
