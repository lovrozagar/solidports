/* eslint-disable testing-library/no-container */
import { createRenderer, describeConformance, isJSDOM, act } from '#test-utils';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { spy } from 'sinon';
import { createSignal, Show } from 'solid-js';
import { renderServer } from '../../../test/ssrFixtures';
import ssrFixtures from './CheckboxRoot.ssr-fixtures';

describe('<Checkbox.Root />', () => {
  const { render } = createRenderer();

  describeConformance(Checkbox.Root, () => ({
    button: true,
    refInstanceof: window.HTMLSpanElement,
    render,
    testComponentPropWith: 'span',
  }));

  describe('ARIA attributes', () => {
    it('sets the correct aria attributes', async () => {
      const [required, setRequired] = createSignal(false);
      render(() => <Checkbox.Root data-testid="test" required={required()} />);

      expect(screen.getByRole('checkbox')).to.equal(screen.getByTestId('test'));
      expect(screen.getByRole('checkbox')).to.have.attribute('aria-checked');
      act(() => setRequired(true));
      expect(screen.getByRole('checkbox')).to.have.attribute('aria-required', 'true');
    });
  });

  describe('extra props', () => {
    it('can override the built-in attributes', async () => {
      render(() => <Checkbox.Root role="switch" />);
      expect(screen.getByRole('switch')).to.have.attribute('role', 'switch');
    });
  });

  describe('id', () => {
    function TestCase(props: {
      checkboxId?: string | undefined;
      checkboxKey?: string | undefined;
      nativeButton: boolean;
    }) {
      // Solid: a keyed `Show` remounts the checkbox when `checkboxKey` changes, as React's `key`.
      return (
        <Field.Root>
          <Field.Label data-testid="label">Label</Field.Label>
          <Show when={props.checkboxKey ?? 'checkbox'} keyed>
            {(_key) => (
              <Checkbox.Root
                id={props.checkboxId}
                nativeButton={props.nativeButton}
                render={props.nativeButton ? 'button' : undefined}
              />
            )}
          </Show>
        </Field.Root>
      );
    }

    function getLabelControl(nativeButton: boolean) {
      return nativeButton
        ? screen.getByRole('checkbox')
        : document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    }

    it.each([false, true])(
      'drops an explicit id when the prop is removed (nativeButton=%s)',
      async (nativeButton) => {
        const [checkboxId, setCheckboxId] = createSignal<string | undefined>('explicit');
        render(() => <TestCase checkboxId={checkboxId()} nativeButton={nativeButton} />);

        const label = screen.getByTestId('label');
        expect(getLabelControl(nativeButton)).to.have.attribute('id', 'explicit');
        expect(label).to.have.attribute('for', 'explicit');

        act(() => setCheckboxId(undefined));

        const control = getLabelControl(nativeButton);
        expect(control.id).not.to.equal('');
        expect(control).not.to.have.attribute('id', 'explicit');
        expect(label).to.have.attribute('for', control.id);
      },
    );

    it.each([false, true])(
      'does not reuse an unmounted Checkbox id for a keyed id-less Checkbox (nativeButton=%s)',
      async (nativeButton) => {
        const [props, setProps] = createSignal<{ checkboxKey: string; checkboxId?: string }>({
          checkboxKey: 'explicit',
          checkboxId: 'explicit',
        });
        render(() => (
          <TestCase
            checkboxKey={props().checkboxKey}
            checkboxId={props().checkboxId}
            nativeButton={nativeButton}
          />
        ));

        const label = screen.getByTestId('label');
        expect(getLabelControl(nativeButton)).to.have.attribute('id', 'explicit');
        expect(label).to.have.attribute('for', 'explicit');

        act(() => setProps({ checkboxKey: 'generated' }));

        const control = getLabelControl(nativeButton);
        expect(control.id).not.to.equal('');
        expect(control).not.to.have.attribute('id', 'explicit');
        expect(label).to.have.attribute('for', control.id);
      },
    );

    // An explicit `id` only reaches the DOM once registration runs, so the server markup carries
    // the provider's generated id on both the label and the control. Rendering `id` right away
    // would instead leave `Field.Label`'s `for` pointing at nothing until hydration.
    it.each([false, true])(
      'defers an explicit id until hydration but keeps Field.Label associated during SSR (nativeButton=%s)',
      async (nativeButton) => {
        const { hydrate } = renderServer(
          ssrFixtures,
          nativeButton ? 'explicitId-nativeButton=true' : 'explicitId-nativeButton=false',
        );

        const control = getLabelControl(nativeButton);
        expect(control.id).not.to.equal('');
        expect(control).not.to.have.attribute('id', 'explicit');
        expect(screen.getByTestId('label')).to.have.attribute('for', control.id);

        hydrate();

        await waitFor(() => {
          expect(getLabelControl(nativeButton)).to.have.attribute('id', 'explicit');
        });
        expect(screen.getByTestId('label')).to.have.attribute('for', 'explicit');
      },
    );
  });

  describe('prop: onClick', () => {
    it('propagates a single click event to ancestors per user click', async () => {
      const handleParentClick = spy();
      render(() => (
        <div onClick={handleParentClick}>
          <Checkbox.Root data-testid="checkbox" />
        </div>
      ));

      fireEvent.click(screen.getByTestId('checkbox'));

      expect(handleParentClick.callCount).to.equal(1);
      expect(screen.getByTestId('checkbox')).to.have.attribute('aria-checked', 'true');
    });

    it('does not propagate to ancestors when stopPropagation() is called', async () => {
      const handleParentClick = spy();
      render(() => (
        <div onClick={handleParentClick}>
          <Checkbox.Root data-testid="checkbox" onClick={(event) => event.stopPropagation()} />
        </div>
      ));

      fireEvent.click(screen.getByTestId('checkbox'));

      expect(handleParentClick.callCount).to.equal(0);
      expect(screen.getByTestId('checkbox')).to.have.attribute('aria-checked', 'true');
    });

    it('propagates a single click event to ancestors with a native button', async () => {
      const handleParentClick = spy();
      render(() => (
        <div onClick={handleParentClick}>
          <Checkbox.Root nativeButton render="button" data-testid="checkbox" />
        </div>
      ));

      fireEvent.click(screen.getByTestId('checkbox'));

      expect(handleParentClick.callCount).to.equal(1);
      expect(screen.getByTestId('checkbox')).to.have.attribute('aria-checked', 'true');
    });

    it('does not propagate to ancestors when stopPropagation() is called with a native button', async () => {
      const handleParentClick = spy();
      render(() => (
        <div onClick={handleParentClick}>
          <Checkbox.Root
            nativeButton
            render="button"
            data-testid="checkbox"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ));

      fireEvent.click(screen.getByTestId('checkbox'));

      expect(handleParentClick.callCount).to.equal(0);
      expect(screen.getByTestId('checkbox')).to.have.attribute('aria-checked', 'true');
    });
  });

  describe('interactions', () => {
    it('tolerates imperative interaction in its ref callback before the hidden input mounts', async () => {
      render(() => (
        <Checkbox.Root
          ref={(element) => {
            if (element) {
              element.focus();
              element.blur();
              element.click();
            }
          }}
        />
      ));

      expect(screen.getByRole('checkbox')).to.have.attribute('aria-checked', 'false');
    });

    it('should change its state when clicked', async () => {
      render(() => <Checkbox.Root />);
      const [checkbox] = screen.getAllByRole('checkbox');
      // querying it separately since hidden true returns both button and input.
      // without hidden it only returns the button (in the above query)
      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });

      expect(checkbox).to.have.attribute('aria-checked', 'false');
      expect(input.checked).to.equal(false);

      act(() => checkbox.click());
      expect(checkbox).to.have.attribute('aria-checked', 'true');
      expect(input.checked).to.equal(true);

      act(() => checkbox.click());
      expect(checkbox).to.have.attribute('aria-checked', 'false');
      expect(input.checked).to.equal(false);
    });

    it('should update its state when changed from outside', async () => {
      function Test() {
        const [checked, setChecked] = createSignal(false);
        return (
          <div>
            <button onClick={() => setChecked((c) => !c)}>Toggle</button>
            <Checkbox.Root checked={checked()} />;
          </div>
        );
      }

      render(() => <Test />);
      const [checkbox] = screen.getAllByRole('checkbox');
      const button = screen.getByText('Toggle');

      expect(checkbox).to.have.attribute('aria-checked', 'false');
      act(() => button.click());
      expect(checkbox).to.have.attribute('aria-checked', 'true');

      act(() => button.click());
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });

    it('should call onCheckedChange when clicked', async () => {
      const handleChange = spy();
      render(() => <Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole('checkbox');

      act(() => checkbox.click());
      expect(handleChange.callCount).to.equal(1);
      expect(handleChange.firstCall.args[0]).to.equal(true);
    });

    it('does not update its state when onCheckedChange cancels the event', async () => {
      const handleChange = spy((_: boolean, eventDetails: Checkbox.Root.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      render(() => <Checkbox.Root onCheckedChange={handleChange} />);
      const checkbox = screen.getByRole('checkbox');
      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });

      fireEvent.click(checkbox);

      expect(handleChange.callCount).to.equal(1);
      expect(checkbox).to.have.attribute('aria-checked', 'false');
      expect(input.checked).to.equal(false);
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = spy((checked, eventDetails) => eventDetails);
      const { user } = render(() => <Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole('checkbox');

      await user.keyboard('{Shift>}');
      await user.click(checkbox);
      await user.keyboard('{/Shift}');

      expect(handleChange.callCount).to.equal(1);
      expect(handleChange.firstCall.returnValue.event.shiftKey).to.equal(true);
    });

    it('should update its state if the underlying input is toggled', async () => {
      render(() => <Checkbox.Root />);
      const checkbox = screen.getByRole('checkbox');
      const internalInput = document.querySelector<HTMLInputElement>('input[type="checkbox"]');

      act(() => internalInput?.click());
      expect(checkbox).to.have.attribute('aria-checked', 'true');
    });

    it('ignores a hidden input click canceled before React handles it', async () => {
      const handleCheckedChange = spy();
      render(() => <Checkbox.Root onCheckedChange={handleCheckedChange} />);

      const checkbox = screen.getByRole('checkbox');
      const input = screen.getAllByRole<HTMLInputElement>('checkbox', { hidden: true })[1];
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();

      fireEvent(input, event);

      expect(handleCheckedChange.callCount).to.equal(0);
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });

    it('can be activated with Space key', async () => {
      const { user } = render(() => <Checkbox.Root />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).to.have.attribute('aria-checked', 'false');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Space]');
      expect(checkbox).to.have.attribute('aria-checked', 'true');
    });

    it('does not activate with Enter key', async () => {
      const { user } = render(() => <Checkbox.Root />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).to.have.attribute('aria-checked', 'false');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Enter]');
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', async () => {
      render(() => <Checkbox.Root disabled />);
      expect(screen.getByRole('checkbox')).to.not.have.attribute('disabled');
      expect(screen.getByRole('checkbox')).to.have.attribute('aria-disabled', 'true');
    });

    it('should not change its state when clicked', async () => {
      render(() => <Checkbox.Root disabled />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).to.have.attribute('aria-checked', 'false');

      act(() => checkbox.click());
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', async () => {
      render(() => <Checkbox.Root readOnly />);
      expect(screen.getAllByRole('checkbox')[0]).to.have.attribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', async () => {
      render(() => <Checkbox.Root />);
      expect(screen.getAllByRole('checkbox')[0]).not.to.have.attribute('aria-readonly');
    });

    it('should not change its state when clicked', async () => {
      render(() => <Checkbox.Root readOnly />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).to.have.attribute('aria-checked', 'false');

      act(() => checkbox.click());
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });

    it('should not change its state when its label is clicked', async () => {
      render(() => (
        <label data-testid="label">
          <Checkbox.Root readOnly />
        </label>
      ));
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).to.have.attribute('aria-checked', 'false');

      const labelElement = screen.getByTestId('label');

      act(() => labelElement.click());

      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });
  });

  describe('prop: indeterminate', () => {
    it('should set the `aria-checked` attribute as "mixed"', async () => {
      render(() => <Checkbox.Root indeterminate />);
      expect(screen.getAllByRole('checkbox')[0]).to.have.attribute('aria-checked', 'mixed');
    });

    it('should not change its state when clicked', async () => {
      render(() => <Checkbox.Root indeterminate />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).to.have.attribute('aria-checked', 'mixed');

      act(() => checkbox.click());
      expect(checkbox).to.have.attribute('aria-checked', 'mixed');
    });

    it('should not have the aria attribute when `indeterminate` is not set', async () => {
      render(() => <Checkbox.Root />);
      expect(screen.getAllByRole('checkbox')[0]).not.to.have.attribute('aria-checked', 'mixed');
    });

    it('should not be overridden by `checked` prop', async () => {
      render(() => <Checkbox.Root indeterminate checked />);
      expect(screen.getAllByRole('checkbox')[0]).to.have.attribute('aria-checked', 'mixed');
    });

    it('sets the native input state when indeterminate', async () => {
      render(() => <Checkbox.Root indeterminate />);

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.indeterminate).to.equal(true);
    });

    it('keeps the native input state when checked changes while indeterminate remains', async () => {
      function App() {
        const [checked, setChecked] = createSignal(false);
        return (
          <Checkbox.Root
            data-testid="button"
            indeterminate
            checked={checked()}
            onCheckedChange={setChecked}
          />
        );
      }

      render(() => <App />);

      // Clicking the hidden input natively clears `indeterminate` before toggling.
      fireEvent.click(screen.getByTestId('button'));

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.checked).to.equal(true);
      expect(input.indeterminate).to.equal(true);
    });

    it('sets indeterminate style hooks on the root and indicator', async () => {
      render(() => (
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" />
        </Checkbox.Root>
      ));

      expect(screen.getByRole('checkbox')).to.have.attribute('data-indeterminate', '');
      expect(screen.getByTestId('indicator')).to.have.attribute('data-indeterminate', '');
    });

    it('sets grouped parent aria when manually indeterminate', async () => {
      render(() => (
        <CheckboxGroup value={[]} allValues={['one']}>
          <Checkbox.Root parent indeterminate data-testid="parent" />
          <Checkbox.Root value="one" />
        </CheckboxGroup>
      ));

      expect(screen.getByTestId('parent')).to.have.attribute('aria-checked', 'mixed');
    });

    it('sets grouped parent native input state when manually indeterminate', async () => {
      render(() => (
        <CheckboxGroup value={[]} allValues={['one']}>
          <Checkbox.Root parent indeterminate data-testid="parent" />
          <Checkbox.Root value="one" />
        </CheckboxGroup>
      ));

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.indeterminate).to.equal(true);
    });
  });

  it('should update its state if the underlying input is toggled', async () => {
    render(() => <Checkbox.Root />);
    const [checkbox] = screen.getAllByRole('checkbox');
    const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
      hidden: true,
    });

    act(() => input.click());
    expect(checkbox).to.have.attribute('aria-checked', 'true');
  });

  it('should place the style hooks on the root and the indicator', async () => {
    const [disabled, setDisabled] = createSignal(true);
    const [readOnly, setReadOnly] = createSignal(true);
    render(() => (
      <Checkbox.Root defaultChecked disabled={disabled()} readOnly={readOnly()} required>
        <Checkbox.Indicator />
      </Checkbox.Root>
    ));

    const [checkbox] = screen.getAllByRole('checkbox');
    const indicator = checkbox.querySelector('span');

    expect(checkbox).to.have.attribute('data-checked', '');
    expect(checkbox).not.to.have.attribute('data-unchecked');

    expect(checkbox).to.have.attribute('data-disabled', '');
    expect(checkbox).to.have.attribute('data-readonly', '');
    expect(checkbox).to.have.attribute('data-required', '');

    expect(indicator).to.have.attribute('data-checked', '');
    expect(indicator).not.to.have.attribute('data-unchecked');

    expect(indicator).to.have.attribute('data-disabled', '');
    expect(indicator).to.have.attribute('data-readonly', '');
    expect(indicator).to.have.attribute('data-required', '');

    act(() => {
      setDisabled(false);
      setReadOnly(false);
    });

    fireEvent.click(checkbox);

    expect(checkbox).to.have.attribute('data-unchecked', '');
    expect(checkbox).not.to.have.attribute('data-checked');
  });

  it('should set the name attribute only on the input', async () => {
    render(() => <Checkbox.Root name="checkbox-name" />);

    const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
      hidden: true,
    });
    expect(input).to.have.attribute('name', 'checkbox-name');
    expect(screen.getByRole('checkbox')).not.to.have.attribute('name');
  });

  // flaky with user.click
  describe('with native <label>', () => {
    it('should toggle the checkbox when a wrapping <label> is clicked', async () => {
      render(() => (
        <label data-testid="label">
          <Checkbox.Root />
          Toggle
        </label>
      ));

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).to.have.attribute('aria-checked', 'false');

      fireEvent.click(screen.getByTestId('label'));
      expect(checkbox).to.have.attribute('aria-checked', 'true');
    });

    it('should toggle the checkbox when a explicitly linked <label> is clicked', async () => {
      render(() => (
        <div>
          <label data-testid="label" for="myCheckbox">
            Toggle
          </label>
          <Checkbox.Root id="myCheckbox" />
        </div>
      ));

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).to.have.attribute('aria-checked', 'false');

      fireEvent.click(screen.getByTestId('label'));
      expect(checkbox).to.have.attribute('aria-checked', 'true');
    });

    it('should associate `id` with the native button when `nativeButton=true`', async () => {
      render(() => (
        <div>
          <label data-testid="label" for="myCheckbox">
            Toggle
          </label>

          <Checkbox.Root id="myCheckbox" nativeButton render="button" />
        </div>
      ));

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).to.have.attribute('id', 'myCheckbox');

      const hiddenInputs = screen.getAllByRole<HTMLInputElement>('checkbox', { hidden: true });
      const hiddenInput = hiddenInputs.find((input) => input !== checkbox);
      expect(hiddenInput).not.to.equal(undefined);
      expect(hiddenInput).not.to.have.attribute('id', 'myCheckbox');

      expect(checkbox).to.have.attribute('aria-checked', 'false');
      fireEvent.click(screen.getByTestId('label'));
      expect(checkbox).to.have.attribute('aria-checked', 'true');
    });

    it('falls back to the Field control id when id is empty', async () => {
      render(() => (
        <Field.Root>
          <Field.Label>Label</Field.Label>
          <Checkbox.Root id="" />
        </Field.Root>
      ));

      const label = screen.getByText('Label');
      const input = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      const checkbox = screen.getByRole('checkbox');

      expect(input.id).not.to.equal('');
      expect(label).to.have.attribute('for', input.id);

      fireEvent.click(label);
      expect(checkbox).to.have.attribute('aria-checked', 'true');
    });

    it('assigns an input id to a valueless child in a parent checkbox group', async () => {
      render(() => (
        <CheckboxGroup allValues={['one']}>
          <Checkbox.Root />
        </CheckboxGroup>
      ));

      const input = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(input.id).not.to.equal('');
    });

    it('assigns a root id to a valueless native button in a parent checkbox group', async () => {
      render(() => (
        <CheckboxGroup allValues={['one']}>
          <Checkbox.Root nativeButton render="button" />
        </CheckboxGroup>
      ));

      expect(screen.getByRole('checkbox').id).not.to.equal('');
    });
  });

  describe('Form', () => {
    it('triggers native HTML validation on submit', async () => {
      const { user } = render(() => (
        <Form>
          <Field.Root name="test" data-testid="field">
            <Checkbox.Root required />
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).to.equal(null);

      await user.click(submit);

      const error = screen.getByTestId('error');
      expect(error).to.have.text('required');
    });

    it('clears external errors on change', async () => {
      render(() => (
        <Form
          errors={{
            test: 'test',
          }}
        >
          <Field.Root name="test" data-testid="field">
            <Checkbox.Root data-testid="checkbox" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      const checkbox = screen.getByTestId('checkbox');

      expect(checkbox).to.have.attribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).to.have.text('test');

      fireEvent.click(checkbox);

      expect(checkbox).not.to.have.attribute('aria-invalid');
      expect(screen.queryByTestId('error')).to.equal(null);
    });

    it.skipIf(isJSDOM)(
      'should include the checkbox value in form submission, matching native checkbox behavior',
      async () => {
        const submitSpy = spy((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-checkbox');
        });

        render(() => (
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        ));

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        act(() => submitButton.click());
        expect(submitSpy.callCount).to.equal(1);
        expect(submitSpy.lastCall.returnValue).to.equal(null);

        act(() => checkbox.click());
        act(() => submitButton.click());
        expect(submitSpy.callCount).to.equal(2);
        expect(submitSpy.lastCall.returnValue).to.equal('on');
      },
    );

    it.skipIf(isJSDOM)('submits the form when Enter is pressed while focused', async () => {
      const submitSpy = spy((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return {
          value: formData.get('test-checkbox'),
          submitter: event.submitter,
        };
      });
      const submitClickSpy = spy();

      const { user } = render(() => (
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-checkbox">
            <Checkbox.Root />
          </Field.Root>
          <button id="submit-button" type="submit" onClick={submitClickSpy}>
            Submit
          </button>
        </Form>
      ));

      const checkbox = screen.getByRole('checkbox');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(submitSpy.callCount).to.equal(1);
      expect(submitSpy.lastCall.returnValue.value).to.equal(null);
      expect(submitSpy.lastCall.returnValue.submitter).to.equal(
        screen.getByRole('button', { name: 'Submit' }),
      );
      expect(submitClickSpy.callCount).to.equal(1);
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when the consumer prevents default',
      async () => {
        const submitSpy = spy((event: SubmitEvent) => {
          event.preventDefault();
        });

        const { user } = render(() => (
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root onKeyDown={(event) => event.preventDefault()} />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        ));

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.callCount).to.equal(0);
        expect(checkbox).to.have.attribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when an ancestor prevents default',
      async () => {
        const submitSpy = spy((event: SubmitEvent) => {
          event.preventDefault();
        });
        const keyDownSpy = spy((event: KeyboardEvent) => {
          const defaultPrevented = event.defaultPrevented;
          event.preventDefault();
          return defaultPrevented;
        });

        const { user } = render(() => (
          <Form onSubmit={submitSpy} onKeyDown={keyDownSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        ));

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        // Solid: there is no synthetic event, so the ancestor sees the native event the
        // checkbox already canceled; React's synthetic `defaultPrevented` is still false here.
        expect(keyDownSpy.callCount).to.equal(1);
        expect(submitSpy.callCount).to.equal(0);
        expect(checkbox).to.have.attribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)('submits the form with Enter when readOnly', async () => {
      const submitSpy = spy((event: SubmitEvent) => {
        event.preventDefault();
        return event.submitter;
      });

      const { user } = render(() => (
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-checkbox">
            <Checkbox.Root readOnly />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const checkbox = screen.getByRole('checkbox');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(submitSpy.callCount).to.equal(1);
      expect(submitSpy.lastCall.returnValue).to.equal(
        screen.getByRole('button', { name: 'Submit' }),
      );
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });

    it.skipIf(isJSDOM)(
      'submits the form once with Enter when rendered as a native button',
      async () => {
        const submitSpy = spy((event: SubmitEvent) => {
          event.preventDefault();
          return event.submitter;
        });
        const submitClickSpy = spy();

        const { user } = render(() => (
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root render="button" nativeButton />
            </Field.Root>
            <button type="submit" onClick={submitClickSpy}>
              Submit
            </button>
          </Form>
        ));

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.callCount).to.equal(1);
        expect(submitSpy.lastCall.returnValue).to.equal(
          screen.getByRole('button', { name: 'Submit' }),
        );
        expect(submitClickSpy.callCount).to.equal(1);
        expect(checkbox).to.have.attribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when there is no submit button',
      async () => {
        const submitSpy = spy((event: SubmitEvent) => {
          event.preventDefault();
        });

        const { user } = render(() => (
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
          </Form>
        ));

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.callCount).to.equal(0);
        expect(checkbox).to.have.attribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when the default button is disabled',
      async () => {
        const submitSpy = spy((event: SubmitEvent) => {
          event.preventDefault();
        });

        const { user } = render(() => (
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
            <button type="submit" disabled>
              Disabled
            </button>
            <button type="submit">Enabled</button>
          </Form>
        ));

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        // getDefaultFormSubmitter intentionally returns the disabled default button;
        // clicking it should be a no-op rather than falling through to a later submitter.
        expect(submitSpy.callCount).to.equal(0);
        expect(checkbox).to.have.attribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = spy((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return formData.get('test-checkbox');
      });

      const { user } = render(() => (
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Checkbox.Root name="test-checkbox" form="external-form" />
        </>
      ));

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button'));

      expect(submitSpy.callCount).to.equal(1);
      expect(submitSpy.lastCall.returnValue).to.equal('on');
    });

    it.skipIf(isJSDOM)(
      'submits to an external form with Enter when `form` is provided',
      async () => {
        const submitSpy = spy((event: SubmitEvent) => {
          event.preventDefault();
          return event.submitter;
        });

        const { user } = render(() => (
          <>
            <Checkbox.Root name="test-checkbox" form="external-form" />
            <form id="external-form" onSubmit={submitSpy}>
              <button type="submit">Submit</button>
            </form>
          </>
        ));

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.callCount).to.equal(1);
        expect(submitSpy.lastCall.returnValue).to.equal(screen.getByRole('button'));
        expect(checkbox).to.have.attribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)('submits uncheckedValue to an external form when unchecked', async () => {
      const submitSpy = spy((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return formData.get('test-checkbox');
      });

      render(() => (
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Checkbox.Root name="test-checkbox" form="external-form" uncheckedValue="off" />
        </>
      ));

      fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.callCount).to.equal(1);
      expect(submitSpy.lastCall.returnValue).to.equal('off');
    });

    it.skipIf(isJSDOM)(
      'should include the custom checkbox value in form submission, matching native checkbox behavior',
      async () => {
        const submitSpy = spy((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-checkbox');
        });

        render(() => (
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root value="test-value" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        ));

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        act(() => submitButton.click());
        expect(submitSpy.callCount).to.equal(1);
        expect(submitSpy.lastCall.returnValue).to.equal(null);

        act(() => checkbox.click());
        act(() => submitButton.click());
        expect(submitSpy.callCount).to.equal(2);
        expect(submitSpy.lastCall.returnValue).to.equal('test-value');
      },
    );

    it.skipIf(isJSDOM)('matches native checkbox form submission behavior', async () => {
      const nativeSubmitSpy = spy((event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return {
          get: formData.get('native'),
          getAll: formData.getAll('native'),
        };
      });

      const customSubmitSpy = spy((event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return {
          get: formData.get('custom'),
          getAll: formData.getAll('custom'),
        };
      });

      const { user: nativeUser } = render(() => (
        <form onSubmit={nativeSubmitSpy}>
          <input type="checkbox" name="native" />
          <button type="submit">Submit</button>
        </form>
      ));

      const nativeCheckbox = screen.getByRole('checkbox');
      const nativeSubmitButton = screen.getByRole('button')!;

      await nativeUser.click(nativeSubmitButton);
      expect(nativeSubmitSpy.lastCall.returnValue.get).to.equal(null);
      expect(nativeSubmitSpy.lastCall.returnValue.getAll).to.deep.equal([]);

      await nativeUser.click(nativeCheckbox);
      await nativeUser.click(nativeSubmitButton);
      expect(nativeSubmitSpy.lastCall.returnValue.get).to.equal('on');

      const { user: customUser } = render(() => (
        <Form onSubmit={customSubmitSpy}>
          <Field.Root name="custom">
            <Checkbox.Root />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const customCheckbox = screen.getAllByRole('checkbox')[1];
      const customSubmitButton = screen.getAllByRole('button')[1]!;

      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.lastCall.returnValue.get).to.equal(null);
      expect(customSubmitSpy.lastCall.returnValue.getAll).to.deep.equal([]);

      await customUser.click(customCheckbox);
      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.lastCall.returnValue.get).to.equal('on');
    });

    it.skipIf(isJSDOM)(
      'should submit uncheckedValue when checkbox is unchecked and uncheckedValue is specified',
      async () => {
        const submitSpy = spy((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-checkbox');
        });

        render(() => (
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root uncheckedValue="off" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        ));

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        act(() => submitButton.click());
        expect(submitSpy.callCount).to.equal(1);
        expect(submitSpy.lastCall.returnValue).to.equal('off');

        act(() => checkbox.click());
        act(() => submitButton.click());
        expect(submitSpy.callCount).to.equal(2);
        expect(submitSpy.lastCall.returnValue).to.equal('on');

        act(() => checkbox.click());
        act(() => submitButton.click());
        expect(submitSpy.callCount).to.equal(3);
        expect(submitSpy.lastCall.returnValue).to.equal('off');
      },
    );

    it.skipIf(isJSDOM)('does not submit uncheckedValue when disabled', async () => {
      const submitSpy = spy((event: SubmitEvent) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget as HTMLFormElement);
        return formData.get('test-checkbox');
      });

      const { user } = render(() => (
        <form onSubmit={submitSpy}>
          <Checkbox.Root name="test-checkbox" uncheckedValue="off" disabled />
          <button type="submit">Submit</button>
        </form>
      ));

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy.callCount).to.equal(1);
      expect(submitSpy.lastCall.returnValue).to.equal(null);
    });

    it.skipIf(isJSDOM)(
      'should submit custom uncheckedValue when checkbox is unchecked',
      async () => {
        const submitSpy = spy((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-checkbox');
        });

        render(() => (
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root uncheckedValue="false" value="true" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        ));

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        act(() => submitButton.click());
        expect(submitSpy.callCount).to.equal(1);
        expect(submitSpy.lastCall.returnValue).to.equal('false');

        act(() => checkbox.click());
        act(() => submitButton.click());
        expect(submitSpy.callCount).to.equal(2);
        expect(submitSpy.lastCall.returnValue).to.equal('true');
      },
    );
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', async () => {
      render(() => (
        <Field.Root disabled>
          <Checkbox.Root />
        </Field.Root>
      ));

      const [checkbox] = screen.getAllByRole('checkbox');
      expect(checkbox).to.have.attribute('aria-disabled', 'true');
    });

    it('should receive name prop from Field.Root', async () => {
      render(() => (
        <Field.Root name="field-checkbox">
          <Checkbox.Root />
        </Field.Root>
      ));

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input).to.have.attribute('name', 'field-checkbox');
    });

    it('[data-touched]', async () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      fireEvent.focus(button);
      fireEvent.blur(button);

      expect(button).to.have.attribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.to.have.attribute('data-dirty');

      fireEvent.click(button);

      expect(button).to.have.attribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when checked after being initially unchecked', async () => {
        render(() => (
          <Field.Root>
            <Checkbox.Root data-testid="button" />
          </Field.Root>
        ));

        const button = screen.getByTestId('button');

        expect(button).not.to.have.attribute('data-filled');

        fireEvent.click(button);

        expect(button).to.have.attribute('data-filled', '');

        fireEvent.click(button);

        expect(button).not.to.have.attribute('data-filled');
      });

      it('removes [data-filled] attribute when unchecked after being initially checked', async () => {
        render(() => (
          <Field.Root>
            <Checkbox.Root data-testid="button" defaultChecked />
          </Field.Root>
        ));

        const button = screen.getByTestId('button');

        expect(button).to.have.attribute('data-filled');

        fireEvent.click(button);

        expect(button).not.to.have.attribute('data-filled', '');
      });

      it('clears [data-filled] when a controlled checkbox remounts unchecked', async () => {
        function App() {
          const [unchecked, setUnchecked] = createSignal(false);
          return (
            <Field.Root data-testid="root">
              {/* Solid: a keyed `Show` remounts the checkbox, as React's `key`. */}
              <Show when={String(unchecked())} keyed>
                {(_key) => <Checkbox.Root checked={!unchecked()} onCheckedChange={() => {}} />}
              </Show>
              <button type="button" onClick={() => setUnchecked(true)}>
                clear
              </button>
            </Field.Root>
          );
        }

        render(() => <App />);

        const root = screen.getByTestId('root');
        expect(root).to.have.attribute('data-filled', '');

        fireEvent.click(screen.getByText('clear'));

        expect(root).not.to.have.attribute('data-filled');
      });

      it('adds [data-filled] attribute when any checkbox is filled when inside a group', async () => {
        render(() => (
          <Field.Root>
            <CheckboxGroup defaultValue={['1', '2']}>
              <Checkbox.Root name="1" data-testid="button-1" />
              <Checkbox.Root name="2" data-testid="button-2" />
            </CheckboxGroup>
          </Field.Root>
        ));

        const button1 = screen.getByTestId('button-1');
        const button2 = screen.getByTestId('button-2');

        expect(button1).to.have.attribute('data-filled');
        expect(button2).to.have.attribute('data-filled');

        fireEvent.click(button1);

        expect(button1).to.have.attribute('data-filled');
        expect(button2).to.have.attribute('data-filled');

        fireEvent.click(button2);

        expect(button1).not.to.have.attribute('data-filled');
        expect(button2).not.to.have.attribute('data-filled');
      });
    });

    it('[data-focused]', async () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.to.have.attribute('data-focused');

      fireEvent.focus(button);

      expect(button).to.have.attribute('data-focused', '');

      fireEvent.blur(button);

      expect(button).not.to.have.attribute('data-focused');
    });

    it('does not set [data-focused] when disabled', async () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root disabled data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      fireEvent.focus(button);

      expect(button).not.to.have.attribute('data-focused');
    });

    it('[data-invalid]', async () => {
      render(() => (
        <Field.Root invalid>
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).to.have.attribute('data-invalid', '');
    });

    it('[data-valid]', async () => {
      render(() => (
        <Field.Root validationMode="onBlur">
          <Checkbox.Root data-testid="button" required />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.to.have.attribute('data-valid');
      expect(button).not.to.have.attribute('data-invalid');

      // Check the checkbox and trigger validation
      fireEvent.click(button);
      fireEvent.focus(button);
      fireEvent.blur(button);

      expect(button).to.have.attribute('data-valid', '');
      expect(button).not.to.have.attribute('data-invalid');
    });

    it('prop: validationMode=onSubmit', async () => {
      render(() => (
        <Form>
          <Field.Root>
            <Checkbox.Root required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.to.have.attribute('aria-invalid');

      fireEvent.click(checkbox);
      expect(checkbox).to.have.attribute('data-checked', '');
      fireEvent.click(checkbox);
      expect(checkbox).to.have.attribute('data-unchecked', '');
      expect(checkbox).not.to.have.attribute('aria-invalid');

      fireEvent.click(screen.getByText('submit'));
      expect(checkbox).to.have.attribute('aria-invalid', 'true');

      fireEvent.click(checkbox);
      expect(checkbox).to.have.attribute('data-checked', '');
      expect(checkbox).not.to.have.attribute('aria-invalid');

      fireEvent.click(checkbox);
      expect(checkbox).to.have.attribute('data-unchecked', '');
      expect(checkbox).to.have.attribute('aria-invalid');

      fireEvent.click(checkbox);
      expect(checkbox).to.have.attribute('data-checked', '');
      expect(checkbox).not.to.have.attribute('aria-invalid');
    });

    it('props: validationMode=onChange', async () => {
      render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.to.have.attribute('aria-invalid');

      fireEvent.click(button);

      expect(button).to.have.attribute('aria-invalid', 'true');
    });

    it('validates once when changed by the user', async () => {
      const validate = spy();

      const { user } = render(() => (
        <Field.Root validationMode="onChange" validate={validate}>
          <Checkbox.Root />
        </Field.Root>
      ));

      await user.click(screen.getByRole('checkbox'));

      expect(validate.callCount).to.equal(1);
      expect(validate.lastCall.args[0]).to.equal(true);
    });

    it('revalidates when a controlled value changes externally', async () => {
      const validateSpy = spy((value: unknown) => ((value as boolean) ? 'error' : null));

      function App() {
        const [checked, setChecked] = createSignal(false);

        return (
          <>
            <Field.Root validationMode="onChange" validate={validateSpy} name="terms">
              <Checkbox.Root
                data-testid="button"
                checked={checked()}
                onCheckedChange={setChecked}
              />
            </Field.Root>
            <button type="button" onClick={() => setChecked((prev) => !prev)}>
              Toggle externally
            </button>
          </>
        );
      }

      render(() => <App />);

      const button = screen.getByTestId('button');
      const toggle = screen.getByText('Toggle externally');

      expect(button).not.to.have.attribute('aria-invalid');
      const initialCallCount = validateSpy.callCount;

      fireEvent.click(toggle);

      expect(validateSpy.callCount).to.equal(initialCallCount + 1);
      expect(validateSpy.lastCall.args[0]).to.equal(true);
      expect(button).to.have.attribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onBlur', async () => {
      render(() => (
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Checkbox.Root data-testid="button" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.to.have.attribute('aria-invalid');

      fireEvent.click(button);
      fireEvent.blur(button);

      expect(button).to.have.attribute('aria-invalid', 'true');
    });

    describe('Field.Label', () => {
      describe('explicit association', () => {
        it('when label and checkbox are siblings', async () => {
          render(() => (
            <Field.Root>
              <Field.Label>Label</Field.Label>
              <Checkbox.Root />
            </Field.Root>
          ));

          const label = screen.getByText('Label');
          expect(label.getAttribute('id')).not.to.equal(null);

          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).to.equal(input?.getAttribute('id'));

          const checkbox = screen.getByRole('checkbox');
          expect(checkbox.getAttribute('aria-labelledby')).to.equal(label.getAttribute('id'));
          expect(checkbox).to.have.attribute('aria-checked', 'false');

          fireEvent.click(label);
          expect(checkbox).to.have.attribute('aria-checked', 'true');
        });
      });

      describe('implicit association', () => {
        it('sets `for` on the label', async () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label">
                <Checkbox.Root />
                OK
              </Field.Label>
            </Field.Root>
          ));

          const label = screen.getByTestId('label');
          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).to.not.equal(null);
          expect(label.getAttribute('for')).to.equal(input?.getAttribute('id'));

          const checkbox = screen.getByRole('checkbox');
          expect(label.getAttribute('id')).to.not.equal(null);
          expect(checkbox.getAttribute('aria-labelledby')).to.equal(label.getAttribute('id'));

          expect(checkbox).to.have.attribute('aria-checked', 'false');
          fireEvent.click(screen.getByText('OK'));
          expect(checkbox).to.have.attribute('aria-checked', 'true');
        });
      });
    });

    it('Field.Description', async () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" aria-describedby="external-description" />
          <Field.Description data-testid="description" />
        </Field.Root>
      ));

      const internalInput = screen.getByRole<HTMLInputElement>('checkbox');

      expect(internalInput).to.have.attribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  it('should change state when clicking the checkbox if it has a wrapping label', async () => {
    render(() => (
      <label data-testid="label">
        <Checkbox.Root />
        Toggle
      </label>
    ));

    const [checkbox] = screen.getAllByRole('checkbox');

    expect(checkbox).to.have.attribute('aria-checked', 'false');

    fireEvent.click(checkbox);

    expect(checkbox).to.have.attribute('aria-checked', 'true');

    fireEvent.click(checkbox);

    expect(checkbox).to.have.attribute('aria-checked', 'false');
  });

  it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
    render(() => (
      <div>
        <label for="checkbox-input">Label</label>
        <Checkbox.Root id="checkbox-input" />
      </div>
    ));

    const label = screen.getByText('Label');
    expect(label.id).not.to.equal('');
    expect(screen.getByRole('checkbox')).to.have.attribute('aria-labelledby', label.id);
  });

  it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
    function TestCase() {
      const [id, setId] = createSignal('checkbox-input-a');

      return (
        <>
          <label for="checkbox-input-a">Label A</label>
          <label for="checkbox-input-b">Label B</label>
          <Checkbox.Root id={id()} />
          <button type="button" onClick={() => setId('checkbox-input-b')}>
            Toggle
          </button>
        </>
      );
    }

    render(() => <TestCase />);

    const checkbox = screen.getByRole('checkbox');
    const labelA = screen.getByText('Label A');

    expect(labelA.id).not.to.equal('');
    expect(checkbox).to.have.attribute('aria-labelledby', labelA.id);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    await waitFor(() => {
      const labelB = screen.getByText('Label B');

      expect(labelB.id).not.to.equal('');
      expect(labelA.id).not.to.equal(labelB.id);
      expect(checkbox).to.have.attribute('aria-labelledby', labelB.id);
    });
  });

  it('can render a native button', async () => {
    const { container, user } = render(() => <Checkbox.Root render="button" nativeButton />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).to.have.attribute('aria-checked', 'false');
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('button')).to.equal(checkbox);

    await user.keyboard('[Tab]');
    expect(checkbox).toHaveFocus();

    await user.keyboard('[Enter]');
    expect(checkbox).to.have.attribute('aria-checked', 'false');

    await user.keyboard('[Space]');
    expect(checkbox).to.have.attribute('aria-checked', 'true');

    await user.click(checkbox);
    expect(checkbox).to.have.attribute('aria-checked', 'false');
  });
});
