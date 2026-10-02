import { createRenderer, describeConformance } from '#test-utils';
import { Dialog } from '@solidports/base-ui/dialog';
import { fireEvent, screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { spy } from 'sinon';

describe('<Dialog.Close />', () => {
  const { render } = createRenderer();

  describeConformance(Dialog.Close, () => ({
    button: true,
    refInstanceof: window.HTMLButtonElement,
    render: (node, props) =>
      render(() => (
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>{node(props!)}</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )),
    testComponentPropWith: 'button',
  }));

  describe('prop: disabled', () => {
    it('disables the button', async () => {
      const handleOpenChange = spy();

      const { user } = render(() => (
        <Dialog.Root onOpenChange={handleOpenChange}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close disabled>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(handleOpenChange.callCount).to.equal(0);

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      expect(handleOpenChange.callCount).to.equal(1);
      expect(handleOpenChange.firstCall.args[0]).to.equal(true);

      const closeButton = screen.getByText('Close');
      expect(closeButton).to.have.attribute('disabled');
      expect(closeButton).to.have.attribute('data-disabled');
      await user.click(closeButton);

      expect(handleOpenChange.callCount).to.equal(1);
    });

    it('custom element', async () => {
      const handleOpenChange = spy();

      const { user } = render(() => (
        <Dialog.Root onOpenChange={handleOpenChange}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close disabled render="span" nativeButton={false}>
                Close
              </Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));

      expect(handleOpenChange.callCount).to.equal(0);

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      expect(handleOpenChange.callCount).to.equal(1);
      expect(handleOpenChange.firstCall.args[0]).to.equal(true);

      const closeButton = screen.getByText('Close');
      expect(closeButton).to.not.have.attribute('disabled');
      expect(closeButton).to.have.attribute('data-disabled');
      expect(closeButton).to.have.attribute('aria-disabled', 'true');
      await user.click(closeButton);

      expect(handleOpenChange.callCount).to.equal(1);
    });
  });

  it('closes the dialog when undefined is passed to the `onClick` prop', async () => {
    const handleOpenChange = spy();

    const { user } = render(() => (
      <Dialog.Root onOpenChange={handleOpenChange}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Close onClick={undefined}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    expect(handleOpenChange.callCount).to.equal(0);

    const openButton = screen.getByText('Open');
    await user.click(openButton);

    expect(handleOpenChange.callCount).to.equal(1);
    expect(handleOpenChange.firstCall.args[0]).to.equal(true);

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    expect(handleOpenChange.callCount).to.equal(2);
    expect(handleOpenChange.secondCall.args[0]).to.equal(false);
  });

  it('does not close the dialog when the Base UI click handler is prevented', async () => {
    const handleOpenChange = spy();

    const { user } = render(() => (
      <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Close onClick={(event) => event.preventBaseUIHandler()}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('dialog')).not.to.equal(null);
    expect(handleOpenChange.callCount).to.equal(0);
  });

  it('does not request another close when clicked after the dialog has closed', () => {
    const handleOpenChange = spy();
    const handleClick = spy();

    render(() => (
      <Dialog.Root open={false} modal={false} onOpenChange={handleOpenChange}>
        <Dialog.Portal keepMounted>
          <Dialog.Popup>
            <Dialog.Close onClick={handleClick}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));

    expect(handleClick.callCount).to.equal(1);
    expect(handleOpenChange.callCount).to.equal(0);
  });
});
