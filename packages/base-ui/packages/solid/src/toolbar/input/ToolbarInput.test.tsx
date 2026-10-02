import { act, createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { DirectionProvider } from '@solidports/base-ui/direction-provider';
import { NumberField } from '@solidports/base-ui/number-field';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { spy } from 'sinon';
import { createSignal } from 'solid-js';
import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, ARROW_UP } from '../../internals/composite/composite';
import { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { NOOP } from '../../utils/noop';
import { type Orientation } from '../../utils/types';
import { ToolbarRootContext } from '../root/ToolbarRootContext';

const testCompositeContext: CompositeRootContext = {
  highlightItemOnHover: () => false,
  highlightedIndex: () => 0,
  onHighlightedIndexChange: NOOP,
  relayKeyboardEvent: NOOP,
};

const testToolbarContext: ToolbarRootContext = {
  disabled: () => false,
  orientation: () => 'horizontal',
};

describe('<Toolbar.Input />', () => {
  const { render } = createRenderer();

  describeConformance(Toolbar.Input, () => ({
    refInstanceof: window.HTMLInputElement,
    render: (node, props) => {
      return render(() => (
        <ToolbarRootContext value={testToolbarContext}>
          <CompositeRootContext value={testCompositeContext}>{node(props!)}</CompositeRootContext>
        </ToolbarRootContext>
      ));
    },
    testRenderPropWith: 'input',
  }));

  describe('ARIA attributes', () => {
    it('renders a textbox', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Input data-testid="input" />
        </Toolbar.Root>
      ));

      expect(screen.getByTestId('input')).to.equal(screen.getByRole('textbox'));
    });
  });

  describe('pointer interactions', () => {
    it('does not steal focus while disabled and becomes pointer-focusable when enabled', async () => {
      const [disabled, setDisabled] = createSignal(true);

      function TestInput() {
        return (
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" />
            <Toolbar.Input data-testid="input" disabled={disabled()} />
          </Toolbar.Root>
        );
      }

      const { user } = render(() => <TestInput />);
      const button = screen.getByTestId('button');
      const input = screen.getByTestId('input');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(input);
      expect(button).toHaveFocus();

      act(() => setDisabled(false));
      await user.click(input);
      expect(input).toHaveFocus();
    });

    it('prevents click default actions while disabled', async () => {
      const [disabled, setDisabled] = createSignal(true);

      function TestInput() {
        return (
          <Toolbar.Root>
            <Toolbar.Input type="checkbox" disabled={disabled()} />
          </Toolbar.Root>
        );
      }

      const { user } = render(() => <TestInput />);
      const input = screen.getByRole('checkbox');

      await user.click(input);
      expect(input).not.toBeChecked();

      act(() => setDisabled(false));
      await user.click(input);
      expect(input).toBeChecked();
    });
  });

  describe.skipIf(isJSDOM)('keyboard navigation', () => {
    it.each([
      ['ltr', ARROW_RIGHT, ARROW_LEFT],
      ['rtl', ARROW_LEFT, ARROW_RIGHT],
    ] as const)(
      'respects caret and selection boundaries in horizontal %s toolbars',
      async (direction, nextKey, previousKey) => {
        const { user } = render(() => (
          <DirectionProvider direction={direction}>
            <Toolbar.Root orientation="horizontal">
              <Toolbar.Button data-testid="before" />
              <Toolbar.Input defaultValue="abcd" />
              <Toolbar.Button data-testid="after" />
            </Toolbar.Root>
          </DirectionProvider>
        ));
        const input = screen.getByRole('textbox') as HTMLInputElement;
        const before = screen.getByTestId('before');
        const after = screen.getByTestId('after');

        await user.keyboard('[Tab]');
        await user.keyboard(`[${nextKey}]`);
        expect(input).toHaveFocus();

        input.setSelectionRange(1, 3);
        await user.keyboard(`[${nextKey}]`);
        expect(input).toHaveFocus();

        input.setSelectionRange(2, 2);
        await user.keyboard(`[ShiftLeft>][${nextKey}][/ShiftLeft]`);
        expect(input).toHaveFocus();

        const nextBoundary =
          direction === 'rtl' || nextKey === ARROW_RIGHT ? input.value.length : 0;
        input.setSelectionRange(nextBoundary, nextBoundary);
        await user.keyboard(`[${nextKey}]`);
        expect(after).toHaveFocus();

        await user.keyboard(`[${previousKey}]`);
        expect(input).toHaveFocus();
        const previousBoundary =
          direction === 'rtl' || previousKey === ARROW_LEFT ? 0 : input.value.length;
        input.setSelectionRange(previousBoundary, previousBoundary);
        await user.keyboard(`[${previousKey}]`);
        expect(before).toHaveFocus();
      },
    );

    // when navigating through RTL text in real browsers the arrow keys for
    // moving the text insertion cursor is also reversed from LTR but this doesn't
    // work with testing library
    [
      ['horizontal', ARROW_RIGHT, ARROW_LEFT],
      ['vertical', ARROW_DOWN, ARROW_UP],
    ].forEach((entry) => {
      const [orientation, nextKey, prevKey] = entry;

      it(`orientation: ${orientation}`, async () => {
        const { user } = render(() => (
          <Toolbar.Root orientation={orientation as Orientation}>
            <Toolbar.Button />
            <Toolbar.Input defaultValue="abcd" />
            <Toolbar.Button />
          </Toolbar.Root>
        ));
        const input = screen.getByRole('textbox') as HTMLInputElement;
        const [button1, button2] = screen.getAllByRole('button');

        await user.keyboard('[Tab]');
        expect(button1).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);
        expect(input).toHaveFocus();

        // Firefox doesn't support document.getSelection() in inputs
        expect(input.selectionStart).to.equal(0);
        expect(input.selectionEnd).to.equal(4);

        await user.keyboard(`[${ARROW_RIGHT}]`);
        await user.keyboard(`[${nextKey}]`);

        expect(button2).toHaveFocus();

        await user.keyboard(`[${prevKey}]`);
        expect(input).toHaveFocus();

        await user.keyboard(`[${ARROW_LEFT}]`);
        await user.keyboard(`[${prevKey}]`);

        expect(button1).toHaveFocus();
      });
    });
  });

  describe.skipIf(isJSDOM)('disabled', () => {
    it('does not trap keyboard focus when disabled', async () => {
      const { user } = render(() => (
        <div>
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" />
            <Toolbar.Input defaultValue="abcd" disabled />
          </Toolbar.Root>
          <button type="button" data-testid="after">
            after
          </button>
        </div>
      ));

      const button = screen.getByTestId('button');
      const input = screen.getByRole('textbox');
      const after = screen.getByTestId('after');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard(`[${ARROW_RIGHT}]`);
      expect(input).toHaveFocus();

      // Tab must leave the toolbar instead of being trapped on the disabled input
      await user.keyboard('[Tab]');
      expect(after).toHaveFocus();

      await user.keyboard('[ShiftLeft>][Tab][/ShiftLeft]');
      expect(input).toHaveFocus();
    });

    it('does not block vertical roving focus when disabled', async () => {
      const { user } = render(() => (
        <Toolbar.Root orientation="vertical">
          <Toolbar.Button data-testid="button1" />
          <Toolbar.Input defaultValue="abcd" disabled />
          <Toolbar.Button data-testid="button2" />
        </Toolbar.Root>
      ));

      const input = screen.getByRole('textbox');
      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(input).toHaveFocus();

      // ArrowDown must move roving focus past the disabled input
      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(button2).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(button1).toHaveFocus();
    });
  });

  describe('rendering NumberField', () => {
    it('renders NumberField.Input', async () => {
      render(() => (
        <Toolbar.Root>
          <NumberField.Root>
            <NumberField.Group>
              <Toolbar.Input render={{ component: NumberField.Input }} />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>
      ));

      expect(screen.getByRole('textbox')).to.have.attribute('aria-roledescription', 'Number field');
    });

    it('handles interactions', async () => {
      const onValueChange = spy();
      const { user } = render(() => (
        <Toolbar.Root>
          <NumberField.Root min={1} max={10} defaultValue={5} onValueChange={onValueChange}>
            <NumberField.Group>
              <NumberField.Decrement />
              <Toolbar.Input render={{ component: NumberField.Input }} />
              <NumberField.Increment />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>
      ));

      const input = () => screen.getByRole('textbox');

      await user.keyboard('[Tab]');
      expect(input()).to.have.attribute('tabindex', '0');
      expect(input()).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(onValueChange.callCount).to.equal(1);
      expect(onValueChange.args[0][0]).to.equal(6);

      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(onValueChange.callCount).to.equal(2);
      expect(onValueChange.args[1][0]).to.equal(5);
    });

    it('disabled state', async () => {
      const onValueChange = spy();
      const { user } = render(() => (
        <Toolbar.Root>
          <NumberField.Root min={1} max={10} defaultValue={5} onValueChange={onValueChange}>
            <NumberField.Group>
              <NumberField.Decrement />
              <Toolbar.Input disabled render={{ component: NumberField.Input }} />
              <NumberField.Increment />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>
      ));

      const input = () => screen.getByRole('textbox');

      expect(input()).to.not.have.attribute('disabled');
      expect(input()).to.have.attribute('data-disabled');
      expect(input()).to.have.attribute('aria-disabled', 'true');

      await user.keyboard('[Tab]');
      expect(input()).to.have.attribute('tabindex', '0');
      expect(input()).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(onValueChange.callCount).to.equal(0);
    });
  });
});
