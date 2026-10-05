import * as React from 'react';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { NumberField } from '@base-ui/react/number-field';
import { OTPField } from '@base-ui/react/otp-field';
import { size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function FieldControlled() {
  const value = useExposed('value', '');
  return (
    <Field.Root data-testid="field">
      <Field.Label>Name</Field.Label>
      <Field.Control data-testid="control" value={value} onValueChange={setExposed('value')} />
    </Field.Root>
  );
}

function FieldUncontrolled() {
  return (
    <Field.Root data-testid="field">
      <Field.Label>Name</Field.Label>
      <Field.Control data-testid="control" />
    </Field.Root>
  );
}

function FieldValidateOnChange() {
  return (
    <Field.Root
      data-testid="field"
      validationMode="onChange"
      validate={(value) => (String(value).length % 2 === 1 ? 'Odd length' : null)}
    >
      <Field.Label>Name</Field.Label>
      <Field.Control data-testid="control" />
      <Field.Error data-testid="error" />
    </Field.Root>
  );
}

function Form50() {
  const errors = useExposed('errors', {} as Record<string, string>);
  return (
    <Form data-testid="form" errors={errors} onSubmit={(event) => event.preventDefault()}>
      {range(50).map((i) => (
        <Field.Root key={i} name={`f${i}`}>
          <Field.Label>Field {i}</Field.Label>
          <Field.Control data-testid={`c${i}`} required />
          <Field.Error data-testid="error" />
        </Field.Root>
      ))}
      <button type="submit" data-testid="submit">
        Submit
      </button>
    </Form>
  );
}

function NumberFields() {
  return (
    <div>
      {range(size(100)).map((i) => (
        <NumberField.Root key={i} defaultValue={100} allowWheelScrub>
          <NumberField.Group>
            <NumberField.Decrement>-</NumberField.Decrement>
            <NumberField.Input data-testid="nf-input" />
            <NumberField.Increment data-testid="nf-increment">+</NumberField.Increment>
          </NumberField.Group>
        </NumberField.Root>
      ))}
    </div>
  );
}

function otp(length: number) {
  return function OTP() {
    return (
      <OTPField.Root data-testid="otp" length={length} validationType="alphanumeric">
        {range(length).map((i) => (
          <OTPField.Input key={i} aria-label={`Character ${i + 1}`} />
        ))}
      </OTPField.Root>
    );
  };
}

export const fixtures: Record<string, React.FC> = {
  'field/controlled': FieldControlled,
  'field/uncontrolled': FieldUncontrolled,
  'field/validate-on-change': FieldValidateOnChange,
  'form/50': Form50,
  'number-field/100': NumberFields,
  'otp-field/6': otp(6),
  'otp-field/12': otp(12),
};
