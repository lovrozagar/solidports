import { createSignal } from 'solid-js';
import { expect, describe, it } from 'vitest';
import { fireEvent, screen } from '@solidjs/testing-library';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';
import { Fieldset } from '@solidports/base-ui/fieldset';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { Slider } from '@solidports/base-ui/slider';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Fieldset.Root />', () => {
  const { render } = createRenderer();

  describeConformance(Fieldset.Root, () => ({
    inheritComponent: 'fieldset',
    refInstanceof: window.HTMLFieldSetElement,
    render,
  }));

  it('sets the native disabled attribute', async () => {
    render(() => (
      <Fieldset.Root disabled data-testid="fieldset">
        <input />
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('fieldset')).toHaveAttribute('disabled');
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('keeps nested fieldsets disabled when an ancestor fieldset is disabled', async () => {
    render(() => (
      <Fieldset.Root disabled>
        <Fieldset.Root>
          <Field.Root>
            <Field.Control data-testid="control" />
          </Field.Root>
        </Fieldset.Root>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('control')).toHaveAttribute('disabled');
  });

  it('updates nested disabled precedence in both directions', async () => {
    function App() {
      const [outerDisabled, setOuterDisabled] = createSignal(false);
      const [innerDisabled, setInnerDisabled] = createSignal(true);

      return (
        <>
          <Fieldset.Root disabled={outerDisabled()}>
            <Fieldset.Root disabled={innerDisabled()}>
              <Field.Root data-testid="root">
                <Field.Control data-testid="control" />
              </Field.Root>
            </Fieldset.Root>
          </Fieldset.Root>
          <button type="button" onClick={() => setOuterDisabled(true)}>
            Disable outer
          </button>
          <button type="button" onClick={() => setInnerDisabled(false)}>
            Enable inner
          </button>
          <button type="button" onClick={() => setOuterDisabled(false)}>
            Enable outer
          </button>
        </>
      );
    }

    render(() => <App />);

    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
    fireEvent.click(screen.getByRole('button', { name: 'Disable outer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable inner' }));
    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');
    fireEvent.click(screen.getByRole('button', { name: 'Enable outer' }));
    expect(screen.getByTestId('control')).not.toBeDisabled();
    expect(screen.getByTestId('root')).not.toHaveAttribute('data-disabled');
  });

  it('passes disabled to rendered Base UI roots', async () => {
    render(() => (
      <div>
        <Fieldset.Root
          disabled
          render={(props) => <RadioGroup {...props} data-testid="radio-group" />}
        />
        <Fieldset.Root disabled render={(props) => <CheckboxGroup {...props} />}>
          <Checkbox.Root name="apple" data-testid="checkbox" />
        </Fieldset.Root>
        <Fieldset.Root disabled render={(props) => <Slider.Root {...props} defaultValue={50} />}>
          <Slider.Control data-testid="slider-control">
            <Slider.Track>
              <Slider.Thumb />
            </Slider.Track>
          </Slider.Control>
        </Fieldset.Root>
      </div>
    ));

    expect(screen.getByTestId('radio-group')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('checkbox')).toHaveAttribute('data-disabled');
    expect(screen.getByTestId('slider-control')).toHaveAttribute('data-disabled');
  });
});
