import { createSignal, flush } from 'solid-js';
import { screen, fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { Combobox } from '@solidports/base-ui/combobox';
import { Field } from '@solidports/base-ui/field';
import { NumberField } from '@solidports/base-ui/number-field';
import { Radio } from '@solidports/base-ui/radio';
import { OTPField } from '@solidports/base-ui/otp-field';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { Select } from '@solidports/base-ui/select';
import { Slider } from '@solidports/base-ui/slider';
import { Switch } from '@solidports/base-ui/switch';
import { createRenderer } from '#test-utils';

/**
 * Disabling a focused control does not fire blur in jsdom. The field must still drop
 * `data-focused`, and only the control that took focus may clear it.
 */
describe('field focus follows the active control', () => {
  const { render } = createRenderer();

  function expectReleased(focus: () => HTMLElement, setDisabled: (disabled: boolean) => void) {
    const field = screen.getByTestId('field');
    const control = focus();
    control.focus();
    flush();
    expect(field).toHaveAttribute('data-focused', '');

    setDisabled(true);
    flush();
    expect(field).not.toHaveAttribute('data-focused');
  }

  it('releases a checkbox when it becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false);
    render(() => (
      <Field.Root data-testid="field">
        <Checkbox.Root disabled={disabled()} />
      </Field.Root>
    ));
    expectReleased(() => screen.getByRole('checkbox'), setDisabled);
  });

  it('releases a switch when it becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false);
    render(() => (
      <Field.Root data-testid="field">
        <Switch.Root disabled={disabled()} />
      </Field.Root>
    ));
    expectReleased(() => screen.getByRole('switch'), setDisabled);
  });

  it('releases a radio when it becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false);
    render(() => (
      <Field.Root data-testid="field">
        <Radio.Root value="a" disabled={disabled()} />
      </Field.Root>
    ));
    expectReleased(() => screen.getByRole('radio'), setDisabled);
  });

  it('releases a number field when it becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false);
    render(() => (
      <Field.Root data-testid="field">
        <NumberField.Root disabled={disabled()}>
          <NumberField.Input />
        </NumberField.Root>
      </Field.Root>
    ));
    expectReleased(() => screen.getByRole('textbox'), setDisabled);
  });

  it('releases a select when it becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false);
    render(() => (
      <Field.Root data-testid="field">
        <Select.Root disabled={disabled()}>
          <Select.Trigger>Open</Select.Trigger>
        </Select.Root>
      </Field.Root>
    ));
    expectReleased(() => screen.getByRole('combobox'), setDisabled);
  });

  it('releases a combobox input when it becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false);
    render(() => (
      <Field.Root data-testid="field">
        <Combobox.Root disabled={disabled()}>
          <Combobox.Input />
        </Combobox.Root>
      </Field.Root>
    ));
    expectReleased(() => screen.getByRole('combobox'), setDisabled);
  });

  it('releases an OTP field when it becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false);
    render(() => (
      <Field.Root data-testid="field">
        <OTPField.Root disabled={disabled()} length={1}>
          <OTPField.Input />
        </OTPField.Root>
      </Field.Root>
    ));
    expectReleased(() => screen.getByRole('textbox'), setDisabled);
  });

  it('releases a slider when it becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false);
    render(() => (
      <Field.Root data-testid="field">
        <Slider.Root disabled={disabled()} defaultValue={20}>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      </Field.Root>
    ));
    expectReleased(() => screen.getByRole('slider'), setDisabled);
  });

  it('releases a rendered checkbox when it blurs', () => {
    render(() => (
      <Field.Root data-testid="field">
        <Checkbox.Root render={(props) => <span {...props} />} />
      </Field.Root>
    ));
    const field = screen.getByTestId('field');
    const control = screen.getByRole('checkbox');
    control.focus();
    flush();
    expect(field).toHaveAttribute('data-focused', '');

    fireEvent.blur(control);
    flush();
    expect(field).not.toHaveAttribute('data-focused');
  });

  it('releases a rendered switch when it blurs', () => {
    render(() => (
      <Field.Root data-testid="field">
        <Switch.Root render={(props) => <span {...props} />} />
      </Field.Root>
    ));
    const field = screen.getByTestId('field');
    const control = screen.getByRole('switch');
    control.focus();
    flush();
    expect(field).toHaveAttribute('data-focused', '');

    fireEvent.blur(control);
    flush();
    expect(field).not.toHaveAttribute('data-focused');
  });

  it('releases a rendered radio when it blurs', () => {
    render(() => (
      <Field.Root data-testid="field">
        <Radio.Root value="a" render={(props) => <span {...props} />} />
      </Field.Root>
    ));
    const field = screen.getByTestId('field');
    const control = screen.getByRole('radio');
    control.focus();
    flush();
    expect(field).toHaveAttribute('data-focused', '');

    fireEvent.blur(control);
    flush();
    expect(field).not.toHaveAttribute('data-focused');
  });

  it('keeps field focus when a grouped radio blurs on its own', () => {
    render(() => (
      <Field.Root data-testid="field">
        <RadioGroup>
          <Radio.Root value="a" render={(props) => <span {...props} />} />
          <Radio.Root value="b" render={(props) => <span {...props} />} />
        </RadioGroup>
      </Field.Root>
    ));
    const field = screen.getByTestId('field');
    const [first] = screen.getAllByRole('radio');
    first.focus();
    flush();
    expect(field).toHaveAttribute('data-focused', '');

    fireEvent.blur(first);
    flush();
    expect(field).toHaveAttribute('data-focused', '');
  });

  it('releases an ungrouped radio when it blurs', () => {
    render(() => (
      <Field.Root data-testid="field">
        <Radio.Root value="a" />
      </Field.Root>
    ));
    const field = screen.getByTestId('field');
    const control = screen.getByRole('radio');
    control.focus();
    flush();
    expect(field).toHaveAttribute('data-focused', '');

    fireEvent.blur(control);
    flush();
    expect(field).not.toHaveAttribute('data-focused');
  });

  it('keeps field focus when a radio blur handler cancels the clear', () => {
    render(() => (
      <Field.Root data-testid="field">
        <Radio.Root
          value="a"
          onBlur={(event) => {
            event.preventBaseUIHandler();
          }}
        />
      </Field.Root>
    ));
    const field = screen.getByTestId('field');
    const control = screen.getByRole('radio');
    control.focus();
    flush();
    expect(field).toHaveAttribute('data-focused', '');

    fireEvent.blur(control);
    flush();
    expect(field).toHaveAttribute('data-focused', '');
  });

  it('still releases a radio when its blur handler does not cancel', () => {
    render(() => (
      <Field.Root data-testid="field">
        <Radio.Root value="a" onBlur={() => {}} />
      </Field.Root>
    ));
    const field = screen.getByTestId('field');
    const control = screen.getByRole('radio');
    control.focus();
    flush();
    fireEvent.blur(control);
    flush();
    expect(field).not.toHaveAttribute('data-focused');
  });
});
