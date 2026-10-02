import { createRenderer } from '#test-utils';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

/* Pin: jsdom does not expose PointerEvent as a global, so clicking a checkbox must not
 * construct one unguarded. */
describe('CheckboxRoot PointerEvent shim pin', () => {
  const { render } = createRenderer();

  it('click does not throw ReferenceError in jsdom', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user } = render(() => <Checkbox.Root data-testid="cb" />);
    await expect(user.click(screen.getByTestId('cb'))).resolves.not.toThrow();
    errSpy.mockRestore();
  });
});
