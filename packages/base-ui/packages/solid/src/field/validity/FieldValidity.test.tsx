import { act, createRenderer, isJSDOM } from '#test-utils';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { fireEvent, screen } from '@solidjs/testing-library';
import { spy } from 'sinon';
import { expect, vi } from 'vitest';

describe('<Field.Validity />', () => {
  const { render } = createRenderer();

  ['onBlur', 'onSubmit'].forEach((validationMode) => {
    it(`surfaces valueMissing immediately after a stale custom error in ${validationMode} mode`, () => {
      const handleValidity = vi.fn();
      const validate = vi.fn(() => 'custom error');

      render(() => (
        <Form>
          <Field.Root validationMode={validationMode as 'onBlur' | 'onSubmit'} validate={validate}>
            <Field.Control required />
            <Field.Error match="valueMissing">Required</Field.Error>
            <Field.Validity>{handleValidity}</Field.Validity>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');
      const establishInvalidState = () => {
        if (validationMode === 'onBlur') {
          fireEvent.blur(input);
        } else {
          fireEvent.click(screen.getByText('submit'));
        }
      };

      fireEvent.focus(input);
      fireEvent.input(input, { target: { value: 'invalid' } });
      establishInvalidState();

      expect(handleValidity.mock.lastCall?.[0].value).to.equal('invalid');
      expect(handleValidity.mock.lastCall?.[0].validity.customError).to.equal(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).to.equal(false);
      expect(validate).toHaveBeenCalledTimes(1);

      fireEvent.focus(input);
      fireEvent.input(input, { target: { value: '' } });

      expect(handleValidity.mock.lastCall?.[0].value).to.equal('');
      expect(handleValidity.mock.lastCall?.[0].validity.customError).to.equal(
        validationMode === 'onSubmit',
      );
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).to.equal(true);
      expect(screen.getByText('Required')).toBeVisible();
      expect(validate).toHaveBeenCalledTimes(validationMode === 'onBlur' ? 1 : 2);

      if (validationMode === 'onBlur') {
        fireEvent.blur(input);
      } else {
        fireEvent.click(screen.getByText('submit'));
      }

      expect(handleValidity.mock.lastCall?.[0].value).to.equal('');
      expect(handleValidity.mock.lastCall?.[0].validity.customError).to.equal(
        validationMode === 'onSubmit',
      );
      expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).to.equal(true);
      expect(screen.getByText('Required')).toBeVisible();
    });
  });

  it.skipIf(isJSDOM)('defers badInput during required change revalidation', async () => {
    const { userEvent } = await import('vitest/browser');
    const user = userEvent.setup();
    const handleValidity = vi.fn();

    render(() => (
      <Field.Root validationMode="onBlur" validate={() => 'custom error'}>
        <Field.Control type="number" required />
        <Field.Error match="valueMissing">Required</Field.Error>
        <Field.Error match="badInput">Invalid number</Field.Error>
        <Field.Validity>{handleValidity}</Field.Validity>
      </Field.Root>
    ));

    const input = screen.getByRole<HTMLInputElement>('spinbutton');

    await act(() => user.type(input, '1[Tab]'));

    expect(handleValidity.mock.lastCall?.[0].value).to.equal('1');
    expect(handleValidity.mock.lastCall?.[0].validity.customError).to.equal(true);

    await act(() => user.type(input, '{Control>}a{/Control}e'));

    expect(input.validity.valueMissing).to.equal(true);
    expect(input.validity.badInput).to.equal(true);
    expect(handleValidity.mock.lastCall?.[0].value).to.equal('1');
    expect(handleValidity.mock.lastCall?.[0].validity.valueMissing).to.equal(false);
    expect(handleValidity.mock.lastCall?.[0].validity.badInput).to.equal(false);
    expect(screen.queryByText('Required')).to.equal(null);
    expect(screen.queryByText('Invalid number')).to.equal(null);
  });

  describe('validationMode=onSubmit', () => {
    it('should pass validity data', () => {
      const handleValidity = spy();

      render(() => (
        <Form>
          <Field.Root>
            <Field.Control required />
            <Field.Validity>{handleValidity}</Field.Validity>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(handleValidity.lastCall.args[0].validity.valid).to.equal(null);

      fireEvent.click(screen.getByText('submit'));

      expect(handleValidity.lastCall.args[0].validity.valid).to.equal(false);
      expect(handleValidity.lastCall.args[0].validity.valueMissing).to.equal(true);
      expect(handleValidity.lastCall.args[0]).to.have.property('transitionStatus');

      fireEvent.focus(input);
      fireEvent.input(input, { target: { value: 'test' } });

      expect(handleValidity.lastCall.args[0].value).to.equal('test');
      expect(handleValidity.lastCall.args[0].validity.valid).to.equal(true);
      expect(handleValidity.lastCall.args[0].validity.valueMissing).to.equal(false);
    });
  });

  describe('validationMode=onBlur', () => {
    it('should pass validity data', () => {
      const handleValidity = spy();

      render(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control required />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      expect(handleValidity.lastCall.args[0].validity.valid).to.equal(null);

      fireEvent.focus(input);
      fireEvent.input(input, { target: { value: 'test' } });
      fireEvent.blur(input);

      expect(handleValidity.lastCall.args[0].value).to.equal('test');
      expect(handleValidity.lastCall.args[0].validity.valid).to.equal(true);
      expect(handleValidity.lastCall.args[0].validity.valueMissing).to.equal(false);
    });

    it('should correctly pass errors when validate function returns a string', () => {
      const handleValidity = spy();

      render(() => (
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Field.Control />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(handleValidity.lastCall.args[0].error).to.equal('error');
      expect(handleValidity.lastCall.args[0].errors).to.deep.equal(['error']);
    });

    it('should correctly pass errors when validate function returns an array of strings', () => {
      const handleValidity = spy();

      render(() => (
        <Field.Root validationMode="onBlur" validate={() => ['1', '2']}>
          <Field.Control />
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(handleValidity.lastCall.args[0].error).to.equal('1');
      expect(handleValidity.lastCall.args[0].errors).to.deep.equal(['1', '2']);
    });
  });
});
