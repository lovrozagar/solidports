import { createRenderer, describeConformance, act } from '#test-utils';
import { Toggle } from '@solidports/base-ui/toggle';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { spy } from 'sinon';
import { createSignal } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import { ToggleGroup } from '../toggle-group/ToggleGroup';

describe('<Toggle />', () => {
  const { render } = createRenderer();

  describeConformance(Toggle, () => ({
    button: true,
    refInstanceof: window.HTMLButtonElement,
    render,
    testComponentPropWith: 'button',
  }));

  describe('pressed state', () => {
    it('controlled', async () => {
      function App() {
        const [pressed, setPressed] = createSignal(false);
        return (
          <div>
            <input type="checkbox" checked={pressed()} onChange={() => setPressed(!pressed())} />
            <Toggle pressed={pressed()} />;
          </div>
        );
      }

      render(() => <App />);
      const checkbox = screen.getByRole('checkbox');
      const button = screen.getByRole('button');

      expect(button).to.have.attribute('aria-pressed', 'false');

      act(() => checkbox.click());
      expect(button).to.have.attribute('aria-pressed', 'true');

      act(() => checkbox.click());
      expect(button).to.have.attribute('aria-pressed', 'false');
    });

    it('uncontrolled', async () => {
      render(() => <Toggle defaultPressed={false} />);

      const button = screen.getByRole('button');

      expect(button).to.have.attribute('aria-pressed', 'false');
      act(() => button.click());
      expect(button).to.have.attribute('aria-pressed', 'true');

      act(() => button.click());
      expect(button).to.have.attribute('aria-pressed', 'false');
    });
  });

  describe('prop: onPressedChange', () => {
    it('is called when the pressed state changes', async () => {
      const handlePressed = spy();
      render(() => <Toggle defaultPressed={false} onPressedChange={handlePressed} />);

      const button = screen.getByRole('button');

      act(() => button.click());
      expect(handlePressed.callCount).to.equal(1);
      expect(handlePressed.firstCall.args[0]).to.equal(true);
    });

    it('does not change the pressed state when the event is canceled', async () => {
      render(() => (
        <Toggle
          defaultPressed={false}
          onPressedChange={(_pressed, eventDetails) => {
            eventDetails.cancel();
          }}
        />
      ));

      const button = screen.getByRole('button');

      act(() => button.click());

      expect(button).to.have.attribute('aria-pressed', 'false');
    });

    it('canceling in a grouped Toggle prevents the group value from changing', async () => {
      const onValueChange = spy();

      render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle
            value="one"
            onPressedChange={(_pressed, eventDetails) => {
              eventDetails.cancel();
            }}
          />
          <Toggle value="two" />
        </ToggleGroup>
      ));

      const [button1] = screen.getAllByRole('button');

      act(() => button1.click());

      expect(button1).to.have.attribute('aria-pressed', 'false');
      expect(onValueChange.callCount).to.equal(0);
    });
  });

  describe('prop: disabled', () => {
    it('disables the component', async () => {
      const handlePressed = spy();
      render(() => <Toggle disabled onPressedChange={handlePressed} />);

      const button = screen.getByRole('button');

      expect(button).to.have.attribute('disabled');
      expect(button).to.have.attribute('data-disabled');
      expect(button).to.have.attribute('aria-pressed', 'false');

      act(() => button.click());
      expect(handlePressed.callCount).to.equal(0);
      expect(button).to.have.attribute('aria-pressed', 'false');
    });
  });

  describe('prop: render', () => {
    it('should pass composite props', () => {
      const renderSpy = spy();

      function ToggleRenderComponent(props: { renderProps: ComponentProps<'button'> }) {
        // eslint-disable-next-line solid/reactivity
        renderSpy(props.renderProps);
        return <button type="button" {...props.renderProps} />;
      }

      render(() => (
        <ToggleGroup defaultValue={['left']}>
          <Toggle value="left" render={(props) => <ToggleRenderComponent renderProps={props} />} />
        </ToggleGroup>
      ));

      expect(renderSpy.lastCall.args[0]).to.have.property('tabindex', 0);
    });
  });
});
