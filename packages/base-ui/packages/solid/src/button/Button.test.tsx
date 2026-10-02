import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { Button } from '@solidports/base-ui/button';
import { mergeProps } from '@solidports/base-ui/merge-props';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { spy } from 'sinon';
import { createSignal } from 'solid-js';

describe('<Button />', () => {
  const { render } = createRenderer();

  describeConformance(Button, () => ({
    button: true,
    refInstanceof: window.HTMLButtonElement,
    render,
  }));

  describe('prop: nativeButton', () => {
    it('custom link element: Space activates the link without scrolling the page', async () => {
      const handleClick = spy();

      const { user } = render(() => (
        <Button
          nativeButton={false}
          render={(props) => <a href="#target" {...props} />}
          onClick={handleClick}
        >
          Go
        </Button>
      ));

      const link = screen.getByRole('button', { name: 'Go' });
      expect(link.tagName).to.equal('A');

      await user.keyboard('[Tab]');
      expect(link).toHaveFocus();

      // `fireEvent` returns false when `preventDefault()` was called, i.e. no page scroll.
      expect(fireEvent.keyDown(link, { key: ' ' })).to.equal(false);
      fireEvent.keyUp(link, { key: ' ' });

      expect(handleClick.callCount).to.equal(1);
      await waitFor(() => {
        expect(window.location.hash).to.equal('#target');
      });
    });

    it('custom element: applies button semantics and dispatches real clicks from keyboard activation', async () => {
      const handleClick = spy();
      const handleRenderClick = spy();
      const handleCaptureClick = spy();
      const handleAncestorClick = spy();

      const { user } = render(() => (
        <div onClick={handleAncestorClick}>
          <Button
            nativeButton={false}
            render={(props) => (
              <span
                {...mergeProps<'span'>(props, {
                  onClick: handleRenderClick,
                  // Solid: no `onClickCapture` JSX prop; register the capture listener directly.
                  ref: (element: HTMLSpanElement) =>
                    element.addEventListener('click', handleCaptureClick, true),
                })}
              />
            )}
            onClick={handleClick}
          >
            Save
          </Button>
        </div>
      ));

      const button = screen.getByRole('button', { name: 'Save' });

      expect(button.tagName).to.equal('SPAN');
      expect(button).to.have.attribute('role', 'button');
      expect(button).to.have.attribute('tabindex', '0');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard('[Enter]');
      await user.keyboard('[Space]');

      expect(handleCaptureClick.callCount).to.equal(2);
      expect(handleRenderClick.callCount).to.equal(2);
      expect(handleClick.callCount).to.equal(2);
      expect(handleAncestorClick.callCount).to.equal(2);
    });

    it('custom element: keyboard activation clicks carry modifier key state', async () => {
      const handleClick = spy();

      const { user } = render(() => (
        <Button nativeButton={false} render="span" onClick={handleClick}>
          Save
        </Button>
      ));

      const button = screen.getByRole('button', { name: 'Save' });

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard('{Shift>}[Enter]{/Shift}');

      expect(handleClick.callCount).to.equal(1);
      expect(handleClick.firstCall.args[0].shiftKey).to.equal(true);
    });
  });

  describe('prop: disabled', () => {
    it('native button: uses the disabled attribute and is not focusable', async () => {
      const handleClick = spy();
      const handleMouseDown = spy();
      const handlePointerDown = spy();
      const handleKeyDown = spy();

      const { user } = render(() => (
        <Button
          disabled
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        />
      ));

      const button = screen.getByRole('button');

      expect(button).to.have.attribute('disabled');
      expect(button).to.have.attribute('data-disabled');
      expect(button).not.to.have.attribute('aria-disabled');

      await user.keyboard('[Tab]');
      expect(button).not.toHaveFocus();

      await user.click(button);
      await user.keyboard('[Space]');
      await user.keyboard('[Enter]');

      expect(handleClick.callCount).to.equal(0);
      expect(handleMouseDown.callCount).to.equal(0);
      expect(handlePointerDown.callCount).to.equal(0);
      expect(handleKeyDown.callCount).to.equal(0);
    });

    it('custom element: applies aria-disabled and is not focusable', async () => {
      const handleClick = spy();
      const handleMouseDown = spy();
      const handlePointerDown = spy();
      const handleKeyDown = spy();

      const { user } = render(() => (
        <Button
          disabled
          nativeButton={false}
          render="span"
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        />
      ));

      const button = screen.getByRole('button');

      expect(button).to.not.have.attribute('disabled');
      expect(button).to.have.attribute('data-disabled');
      expect(button).to.have.attribute('aria-disabled', 'true');
      expect(button).to.have.attribute('tabindex', '-1');

      await user.keyboard('[Tab]');
      expect(button).not.toHaveFocus();

      await user.click(button);
      await user.keyboard('[Space]');
      await user.keyboard('[Enter]');

      expect(handleClick.callCount).to.equal(0);
      expect(handleMouseDown.callCount).to.equal(0);
      expect(handlePointerDown.callCount).to.equal(0);
      expect(handleKeyDown.callCount).to.equal(0);
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    it('native button: prevents interactions but remains focusable', async () => {
      const handleClick = spy();
      const handleMouseDown = spy();
      const handlePointerDown = spy();
      const handleKeyDown = spy();

      const { user } = render(() => (
        <Button
          disabled
          focusableWhenDisabled
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        />
      ));

      const button = screen.getByRole('button');

      expect(button).to.not.have.attribute('disabled');
      expect(button).to.have.attribute('data-disabled');
      expect(button).to.have.attribute('aria-disabled', 'true');
      expect(button).to.have.attribute('tabindex', '0');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(button);
      await user.keyboard('[Space]');
      await user.keyboard('[Enter]');

      expect(handleClick.callCount).to.equal(0);
      expect(handleMouseDown.callCount).to.equal(0);
      expect(handlePointerDown.callCount).to.equal(0);
      expect(handleKeyDown.callCount).to.equal(0);
    });

    it.skipIf(isJSDOM)(
      'native button: allows hover handlers while blocking activation',
      async () => {
        const handleClick = spy();
        const handleMouseMove = spy();

        const { user } = render(() => (
          <Button
            disabled
            focusableWhenDisabled
            onClick={handleClick}
            onMouseMove={handleMouseMove}
          />
        ));

        const button = screen.getByRole('button');

        expect(button).to.not.have.attribute('disabled');
        expect(button).to.have.attribute('data-disabled');
        expect(button).to.have.attribute('aria-disabled', 'true');

        await user.hover(button);

        expect(handleMouseMove.called).to.equal(true);

        await user.click(button);

        expect(handleClick.callCount).to.equal(0);
      },
    );

    it('keeps focus and suppresses interactions after becoming disabled', async () => {
      const handleClick = spy();

      function TestButton() {
        const [disabled, setDisabled] = createSignal(false);

        return (
          <Button
            disabled={disabled()}
            focusableWhenDisabled
            onClick={(event) => {
              handleClick(event);
              setDisabled(true);
            }}
          >
            Save
          </Button>
        );
      }

      const { user } = render(() => <TestButton />);

      const button = screen.getByRole('button', { name: 'Save' });

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(button);

      expect(handleClick.callCount).to.equal(1);
      expect(button).toHaveFocus();
      expect(button).to.have.attribute('aria-disabled', 'true');

      await user.click(button);
      await user.keyboard('[Enter]');
      await user.keyboard('[Space]');

      expect(handleClick.callCount).to.equal(1);
      expect(button).toHaveFocus();
    });

    it('custom element: prevents interactions but remains focusable', async () => {
      const handleClick = spy();
      const handleMouseDown = spy();
      const handlePointerDown = spy();
      const handleKeyDown = spy();

      const { user } = render(() => (
        <Button
          disabled
          focusableWhenDisabled
          nativeButton={false}
          render="span"
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
        />
      ));

      const button = screen.getByRole('button');

      expect(button).to.not.have.attribute('disabled');
      expect(button).to.have.attribute('data-disabled');
      expect(button).to.have.attribute('aria-disabled', 'true');
      expect(button).to.have.attribute('tabindex', '0');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(button);
      await user.keyboard('[Space]');
      await user.keyboard('[Enter]');

      expect(handleClick.callCount).to.equal(0);
      expect(handleMouseDown.callCount).to.equal(0);
      expect(handlePointerDown.callCount).to.equal(0);
      expect(handleKeyDown.callCount).to.equal(0);
    });
  });
});
