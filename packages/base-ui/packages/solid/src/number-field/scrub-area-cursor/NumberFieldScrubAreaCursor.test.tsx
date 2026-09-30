import { createRenderer, describeConformance } from '#test-utils';
import { isWebKit } from '#utils/detectBrowser';
import { NumberField } from '@solidports/base-ui/number-field';
import { screen } from '@solidjs/testing-library';
import { expect } from 'chai';
import sinon from 'sinon';
import { NumberFieldScrubAreaContext } from '../scrub-area/NumberFieldScrubAreaContext';

const defaultScrubAreaContext: NumberFieldScrubAreaContext = {
  direction: () => 'horizontal',
  isPointerLockDenied: () => false,
  isScrubbing: () => true,
  isTouchInput: () => false,
  pixelSensitivity: () => 2,
  scrubAreaCursorRef: { current: null },
  scrubAreaRef: { current: null },
  teleportDistance: () => undefined,
};

// This component doesn't render on WebKit.
describe.skipIf(isWebKit)('<NumberField.ScrubAreaCursor />', () => {
  const { render } = createRenderer();

  describeConformance(NumberField.ScrubAreaCursor, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) =>
      render(() => (
        <NumberField.Root>
          <NumberField.ScrubArea>
            <NumberFieldScrubAreaContext.Provider value={defaultScrubAreaContext}>
              {node(props!)}
            </NumberFieldScrubAreaContext.Provider>
          </NumberField.ScrubArea>
        </NumberField.Root>
      )),
  }));

  it('has presentation role', async () => {
    render(() => (
      <NumberField.Root>
        <NumberField.ScrubArea />
      </NumberField.Root>
    ));
    expect(screen.queryByRole('presentation')).not.to.equal(null);
  });

  it('renders when using mouse input', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = sinon.stub().resolves();

      const { user } = render(() => (
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');

      await user.pointer({ keys: '[MouseLeft>]', pointerName: 'mouse', target: scrubArea });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(screen.queryByTestId('scrub-area-cursor')).not.to.equal(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('only renders a cursor for the active scrub area', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = sinon.stub().resolves();

      const { user } = render(() => (
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area-1">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
          <NumberField.ScrubArea data-testid="scrub-area-2">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const firstScrubArea = screen.getByTestId('scrub-area-1');

      await user.pointer({ keys: '[MouseLeft>]', pointerName: 'mouse', target: firstScrubArea });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(screen.queryAllByTestId('scrub-area-cursor')).to.have.length(1);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render when using touch input', async () => {
    const { user } = render(() => (
      <NumberField.Root>
        <NumberField.ScrubArea>
          <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
        </NumberField.ScrubArea>
      </NumberField.Root>
    ));

    const scrubArea = screen.getByRole('presentation');

    await user.pointer({ keys: '[TouchA>]', pointerName: 'touch', target: scrubArea });
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });

    expect(screen.queryByTestId('scrub-area-cursor')).to.equal(null);
  });

  it('handles pointer lock denial through requestPointerLock API', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = sinon
        .stub()
        .throws(new Error('User denied pointer lock'));

      const { user } = render(() => (
        <NumberField.Root>
          <NumberField.ScrubArea>
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByRole('presentation');

      await user.pointer({ keys: '[MouseLeft>]', pointerName: 'mouse', target: scrubArea });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });

      expect(screen.queryByTestId('scrub-area-cursor')).to.equal(null);

      const requestLockStub = Element.prototype.requestPointerLock as sinon.SinonStub;
      expect(requestLockStub.called).to.equal(true);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render after a quick tap when pointer lock resolves later', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      // Simulate pointer lock resolving after the user already released the pointer (tap)
      Element.prototype.requestPointerLock = sinon.stub().returns(
        new Promise((resolve) => {
          setTimeout(resolve, 30);
        }),
      );

      const { user } = render(() => (
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');

      // Quick press and release (tap)
      await user.pointer({ keys: '[MouseLeft>]', pointerName: 'mouse', target: scrubArea });
      await user.pointer({ keys: '[/MouseLeft]', pointerName: 'mouse', target: scrubArea });
      window.dispatchEvent(new Event('pointerup'));
      // Wait longer than the delayed pointer lock resolution
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      // After a tap, the scrub cursor should not remain rendered
      expect(screen.queryByTestId('scrub-area-cursor')).to.equal(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });
});
