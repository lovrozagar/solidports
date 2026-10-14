import { createRenderer, describeConformance } from '#test-utils';
import { Dialog } from '@solidports/base-ui/dialog';
import { screen } from '@solidjs/testing-library';
import { expect, vi, describe, it } from 'vitest';

describe('<Dialog.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(Dialog.Trigger, () => ({
    button: true,
    refInstanceof: window.HTMLButtonElement,
    render: (node, props) =>
      render(() => (
        <Dialog.Root open modal={false}>
          {node(props!)}
        </Dialog.Root>
      )),
    testRenderPropWith: 'button',
  }));

  it('throws a descriptive error without a root or handle', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Dialog.Trigger />)).toThrow(
        'Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  describe('prop: disabled', () => {
    it('disables the dialog', async () => {
      const { user } = render(() => (
        <Dialog.Root modal={false}>
          <Dialog.Trigger disabled />
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <Dialog.Title>title text</Dialog.Title>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.click(trigger);
      expect(screen.queryByText('title text')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });

    it('custom element', async () => {
      const { user } = render(() => (
        <Dialog.Root modal={false}>
          <Dialog.Trigger disabled render="span" nativeButton={false} />
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <Dialog.Title>title text</Dialog.Title>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      const trigger = screen.getByRole('button');
      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');

      await user.click(trigger);
      expect(screen.queryByText('title text')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });
  });
});
