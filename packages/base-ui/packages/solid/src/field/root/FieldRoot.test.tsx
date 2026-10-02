import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { NumberField } from '@solidports/base-ui/number-field';
import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { Select } from '@solidports/base-ui/select';
import { Slider } from '@solidports/base-ui/slider';
import { useRef } from '@solidports/base-ui/solid-helpers';
import { Switch } from '@solidports/base-ui/switch';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { spy } from 'sinon';
import type { JSX } from '@solidjs/web';
import { createSignal, For, Show, untrack } from 'solid-js';
import { expect, vi } from 'vitest';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { splitProps } from '../../solid-1-compat';

describe('<Field.Root />', () => {
  const { render } = createRenderer();

  // Solid: a signal swaps the controls; JSX props render lazily in the chosen branch.
  function SwappableField(
    props: Field.Root.Props & {
      firstControl: JSX.Element;
      secondControl: JSX.Element;
    },
  ) {
    const [local, rootProps] = splitProps(props, ['firstControl', 'secondControl', 'children']);
    const [swapped, setSwapped] = createSignal(false);
    return (
      <div>
        <Field.Root {...rootProps}>
          <Show when={swapped()} fallback={local.firstControl}>
            {local.secondControl}
          </Show>
          {local.children}
        </Field.Root>
        <button type="button" onClick={() => setSwapped(true)}>
          swap
        </button>
      </div>
    );
  }

  describeConformance(Field.Root, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  it('updates label association when replacing one control with another', async () => {
    function TestCase() {
      const [showB, setShowB] = createSignal(false);

      return (
        <>
          <Field.Root>
            <Field.Label>Label</Field.Label>
            <Show when={showB()} fallback={<Field.Control id="control-a" />}>
              <Field.Control id="control-b" />
            </Show>
          </Field.Root>
          <button type="button" onClick={() => setShowB(true)}>
            Toggle
          </button>
        </>
      );
    }

    render(() => <TestCase />);

    const label = screen.getByText('Label');
    expect(label).to.have.attribute('for', 'control-a');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    await waitFor(() => {
      expect(label).to.have.attribute('for', 'control-b');
    });
  });

  it('drops a stale explicit id when an id-less control replaces the control that owned it', async () => {
    // Solid: a signal swaps the keyed branches instead of React's `rerender`.
    const [swapped, setSwapped] = createSignal(false);

    render(() => (
      <Field.Root>
        <Field.Label>Label</Field.Label>
        <Show when={swapped()} fallback={<Field.Control id="control" data-testid="control" />}>
          <Field.Control data-testid="control" />
        </Show>
      </Field.Root>
    ));

    const label = screen.getByText('Label');
    expect(label).toHaveAttribute('for', 'control');

    await act(() => setSwapped(true));

    const control = screen.getByTestId('control');
    expect(control.id).not.toBe('control');
    expect(label).toHaveAttribute('for', control.id);
  });

  it('re-associates the label when a CheckboxGroup is replaced by another control', async () => {
    // Solid: a signal swaps the branches instead of React's `rerender`.
    const [multi, setMulti] = createSignal(true);

    render(() => (
      <Field.Root>
        <Field.Label>Answer</Field.Label>
        <Show when={multi()} fallback={<Field.Control data-testid="control" />}>
          <CheckboxGroup allValues={['a']}>
            <Checkbox.Root value="a" />
          </CheckboxGroup>
        </Show>
      </Field.Root>
    ));

    // The group is named through `aria-labelledby`, so it suppresses `htmlFor` entirely.
    expect(screen.getByText('Answer')).not.toHaveAttribute('for');

    await act(() => setMulti(false));

    expect(screen.getByText('Answer')).toHaveAttribute('for', screen.getByTestId('control').id);
  });

  it('updates label associations when the control id changes', async () => {
    function TestCase() {
      const [controlId, setControlId] = createSignal('control-a');

      return (
        <>
          <Field.Root>
            <Field.Label>Label</Field.Label>
            <Field.Control id={controlId()} />
          </Field.Root>
          <button type="button" onClick={() => setControlId('control-b')}>
            Change
          </button>
        </>
      );
    }

    render(() => <TestCase />);

    const label = screen.getByText('Label');

    expect(label).to.have.attribute('for', 'control-a');

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(label).to.have.attribute('for', 'control-b');
    });
  });

  it('falls back to a generated id when the control id is removed', async () => {
    function TestCase() {
      const [controlId, setControlId] = createSignal<string | undefined>('control-a');

      return (
        <>
          <Field.Root>
            <Field.Label>Label</Field.Label>
            <Field.Control id={controlId()} />
          </Field.Root>
          <button type="button" onClick={() => setControlId(undefined)}>
            Clear
          </button>
        </>
      );
    }

    render(() => <TestCase />);

    const label = screen.getByText('Label');
    const control = screen.getByRole('textbox');

    expect(label).to.have.attribute('for', 'control-a');
    expect(control).to.have.attribute('id', 'control-a');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      const updatedControl = screen.getByRole('textbox');
      const updatedId = updatedControl.getAttribute('id') ?? '';

      expect(updatedId).to.not.equal('');
      expect(updatedId).to.not.equal('control-a');
      expect(label).to.have.attribute('for', updatedId);
    });
  });

  // Solid: the test renderer has no server render path (`renderToString`), so the SSR cases
  // assert the client-rendered markup.
  it.skipIf(isJSDOM)('does not set `aria-labelledby` during SSR when Field.Label is absent', () => {
    render(() => (
      <Field.Root>
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value placeholder="Pick one" />
          </Select.Trigger>
        </Select.Root>
      </Field.Root>
    ));

    expect(screen.getByTestId('trigger')).not.toHaveAttribute('aria-labelledby');
  });

  it.skipIf(isJSDOM)(
    'keeps `aria-labelledby` valid when toggling from Checkbox.Root to Select.Root after hydration',
    async () => {
      function TestCase() {
        const [showSelect, setShowSelect] = createSignal(false);

        return (
          <>
            <Field.Root>
              <Field.Label
                nativeLabel={false}
                render={(props) => <div {...props} />}
                data-testid="label"
              >
                Label
              </Field.Label>
              <Show when={showSelect()} fallback={<Checkbox.Root data-testid="checkbox" />}>
                <Select.Root>
                  <Select.Trigger data-testid="trigger">
                    <Select.Value placeholder="Pick one" />
                  </Select.Trigger>
                </Select.Root>
              </Show>
            </Field.Root>
            <button type="button" onClick={() => setShowSelect((prev) => !prev)}>
              Toggle
            </button>
          </>
        );
      }

      render(() => <TestCase />);
      const label = screen.getByTestId('label');

      expect(label.id).not.toBe('');

      await waitFor(() => {
        expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-labelledby', label.id);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-labelledby', label.id);

      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

      const checkboxAfterToggle = screen.getByTestId('checkbox');
      expect(checkboxAfterToggle).toHaveAttribute('aria-labelledby', label.id);
    },
  );

  it.skipIf(isJSDOM)(
    'removes `aria-labelledby` when Field.Label is removed after hydration',
    async () => {
      function TestCase() {
        const [showLabel, setShowLabel] = createSignal(true);

        return (
          <>
            <Field.Root>
              <Show when={showLabel()}>
                <Field.Label
                  nativeLabel={false}
                  render={(props) => <div {...props} />}
                  data-testid="label"
                >
                  Label
                </Field.Label>
              </Show>
              <Select.Root>
                <Select.Trigger data-testid="trigger">
                  <Select.Value placeholder="Pick one" />
                </Select.Trigger>
              </Select.Root>
            </Field.Root>
            <button type="button" onClick={() => setShowLabel(false)}>
              Remove Label
            </button>
          </>
        );
      }

      render(() => <TestCase />);
      const label = screen.getByTestId('label');

      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveAttribute('aria-labelledby', label.id);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Remove Label' }));

      expect(screen.queryByTestId('label')).toBe(null);
      expect(screen.getByTestId('trigger')).not.toHaveAttribute('aria-labelledby');
    },
  );

  // Solid: no `<Activity>`; `<Show>` unmounts and remounts the control instead of hiding it.
  it('preserves label association without looping when a control is unmounted and remounted', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockName('console.error')
      .mockImplementation(() => {});

    try {
      function TestCase() {
        const [showSelect, setShowSelect] = createSignal(true);

        return (
          <>
            <Field.Root>
              <Field.Label data-testid="label">Label</Field.Label>
              <Show when={showSelect()}>
                <Select.Root id="select">
                  <Select.Trigger data-testid="trigger">
                    <Select.Value placeholder="Select a model" />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner>
                      <Select.Popup>
                        <Select.Item value="model">Model</Select.Item>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </Show>
            </Field.Root>
            <Checkbox.Root
              checked={!showSelect()}
              onCheckedChange={(checked) => {
                setShowSelect(!checked);
              }}
            />
          </>
        );
      }

      render(() => <TestCase />);

      const checkbox = screen.getByRole('checkbox');
      const label = screen.getByTestId('label');
      const triggerId = screen.getByTestId('trigger').id;

      expect(label).toHaveAttribute('for', triggerId);

      fireEvent.click(checkbox);

      // With no registered control left, the provider keeps the last selection.
      expect(label).toHaveAttribute('for', triggerId);

      fireEvent.click(checkbox);

      expect(label).toHaveAttribute('for', screen.getByTestId('trigger').id);
      expect(errorSpy.mock.calls.length).toBe(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  // Solid: no `<Activity>`; `<Show>` unmounts and remounts the control instead of hiding it.
  it('preserves a non-native label association when a control is unmounted and remounted', async () => {
    function TestCase() {
      const [showSelect, setShowSelect] = createSignal(true);

      return (
        <>
          <Field.Root>
            <Field.Label
              nativeLabel={false}
              render={(props) => <div {...props} />}
              data-testid="label"
            >
              Label
            </Field.Label>
            <Show when={showSelect()}>
              <Select.Root>
                <Select.Trigger data-testid="trigger">
                  <Select.Value placeholder="Select a model" />
                </Select.Trigger>
              </Select.Root>
            </Show>
          </Field.Root>
          <Checkbox.Root
            checked={!showSelect()}
            onCheckedChange={(checked) => {
              setShowSelect(!checked);
            }}
          />
        </>
      );
    }

    render(() => <TestCase />);

    const checkbox = screen.getByRole('checkbox');
    const labelId = screen.getByTestId('label').id;

    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-labelledby', labelId);

    fireEvent.click(checkbox);

    expect(screen.queryByTestId('trigger')).toBe(null);

    fireEvent.click(checkbox);

    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-labelledby', labelId);
  });

  // Solid: no `<Activity>` that tears effects down while keeping the DOM of a hidden subtree.
  it.skip('keeps an explicit control id while the subtree is hidden', () => {});

  // Solid: no `<Activity>` that tears effects down while keeping the DOM of a hidden subtree.
  it.skip('keeps the group label suppressed while its subtree is hidden', () => {});

  describe('prop: disabled', () => {
    it('should add data-disabled style hook to all components', async () => {
      render(() => (
        <Field.Root data-testid="field" disabled>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="message" />
        </Field.Root>
      ));

      const field = screen.getByTestId('field');
      const control = screen.getByTestId('control');
      const label = screen.getByTestId('label');
      const message = screen.getByTestId('message');

      expect(field).to.have.attribute('data-disabled', '');
      expect(control).to.have.attribute('data-disabled', '');
      expect(label).to.have.attribute('data-disabled', '');
      expect(message).to.have.attribute('data-disabled', '');
    });

    it('keeps an explicitly invalid field marked invalid while disabled', async () => {
      render(() => (
        <Field.Root data-testid="field" disabled invalid>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="description" />
        </Field.Root>
      ));

      const field = screen.getByTestId('field');
      const control = screen.getByTestId('control');
      const label = screen.getByTestId('label');
      const description = screen.getByTestId('description');

      expect(field).toHaveAttribute('data-invalid', '');
      expect(control).toHaveAttribute('data-invalid', '');
      expect(label).toHaveAttribute('data-invalid', '');
      expect(description).toHaveAttribute('data-invalid', '');

      // It does not participate in native constraint validation.
      expect(control).not.toHaveAttribute('aria-invalid');
    });

    it('keeps a disabled field with form errors marked invalid', async () => {
      render(() => (
        <Form errors={{ name: 'Server error' }}>
          <Field.Root name="name" disabled>
            <Field.Control data-testid="control" />
          </Field.Root>
        </Form>
      ));

      const control = screen.getByTestId('control');

      expect(control).toHaveAttribute('data-invalid', '');
      // It does not participate in native constraint validation.
      expect(control).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('prop: validate', () => {
    it('when not in <Form> the function does not run by default', () => {
      const validateSpy = spy(() => 'error');
      render(() => (
        <Field.Root validate={validateSpy}>
          <Field.Control />
          <Field.Error />
        </Field.Root>
      ));

      const control = screen.getByRole('textbox');
      const message = screen.queryByText('error');

      expect(message).to.equal(null);

      fireEvent.focus(control);
      fireEvent.input(control, { target: { value: 'abc' } });
      expect(validateSpy.callCount).to.equal(0);
      expect(screen.queryByText('error')).to.equal(null);

      fireEvent.blur(control);
      expect(validateSpy.callCount).to.equal(0);
      expect(screen.queryByText('error')).to.equal(null);
    });

    it('runs after native validations', async () => {
      render(() => (
        <Form>
          <Field.Root validate={(val) => (val === 'ab' ? 'custom error' : null)}>
            <Field.Control required />
            <Field.Error match="valueMissing">value missing</Field.Error>
            <Field.Error match="customError" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      expect(screen.queryByText('value missing')).to.equal(null);
      expect(screen.queryByText('custom error')).to.equal(null);

      const input = screen.getByRole<HTMLInputElement>('textbox');

      // submit
      fireEvent.click(screen.getByText('submit'));
      expect(screen.queryByText('value missing')).not.to.equal(null);
      expect(screen.queryByText('custom error')).to.equal(null);

      fireEvent.focus(input);
      // revalidate
      fireEvent.input(input, { target: { value: 'ab' } });
      expect(screen.queryByText('value missing')).to.equal(null);
      expect(screen.queryByText('custom error')).not.to.equal(null);

      fireEvent.input(input, { target: { value: '' } });
      expect(screen.queryByText('value missing')).not.to.equal(null);
      // expect(screen.queryByText('custom error')).to.equal(null);
    });

    (
      [
        ['an empty array', () => []],
        ['an undefined', () => undefined],
        ['an empty string', () => ''],
        ['an array of empty strings', () => ['', '']],
      ] as const
    ).forEach(([label, validate]) => {
      it(`treats ${label} result as valid`, async () => {
        const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

        render(() => (
          <Form onSubmit={onSubmit}>
            <Field.Root name="field" validationMode="onChange" validate={validate}>
              <Field.Control data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const control = screen.getByTestId('control');

        fireEvent.input(control, { target: { value: 'abc' } });

        expect(control).not.toHaveAttribute('aria-invalid');
        expect(control).not.toHaveAttribute('data-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
        expect(control).toHaveProperty('validationMessage', '');

        fireEvent.click(screen.getByText('submit'));

        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });

    describe('async validation pending state', () => {
      (['onSubmit', 'onChange', 'onBlur'] as const).forEach((validationMode) => {
        it(`publishes neutral validity while a validator is in flight in ${validationMode} mode`, async () => {
          let resolveValidate: ((value: string | null) => void) | undefined;
          const validate = vi.fn(
            () =>
              new Promise<string | null>((resolve) => {
                resolveValidate = resolve;
              }),
          );

          render(() => (
            <Form onSubmit={(event) => event.preventDefault()}>
              <Field.Root
                data-testid="root"
                name="username"
                validationMode={validationMode}
                validate={validate}
              >
                <Field.Control data-testid="control" />
                <Field.Error data-testid="error" />
              </Field.Root>
              <button type="submit">submit</button>
            </Form>
          ));

          const root = screen.getByTestId('root');
          const control = screen.getByTestId('control');

          fireEvent.input(control, { target: { value: 'taken' } });
          if (validationMode === 'onBlur') {
            fireEvent.blur(control);
          } else if (validationMode === 'onSubmit') {
            fireEvent.click(screen.getByText('submit'));
          }

          expect(validate).toHaveBeenCalledTimes(1);
          expect(root).not.toHaveAttribute('data-valid');
          expect(root).not.toHaveAttribute('data-invalid');
          expect(control).not.toHaveAttribute('aria-invalid');
          expect(screen.queryByTestId('error')).toBe(null);

          await act(async () => {
            resolveValidate?.('Username is taken');
            await flushMicrotasks();
          });

          expect(root).toHaveAttribute('data-invalid', '');
          expect(control).toHaveAttribute('aria-invalid', 'true');
          expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');
        });
      });

      (['onChange', 'onBlur'] as const).forEach((validationMode) => {
        it(`retires a previously valid result to neutral while revalidating in ${validationMode} mode`, async () => {
          const resolvers: Array<(value: string | null) => void> = [];
          const validate = vi.fn(
            () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve);
              }),
          );

          render(() => (
            <Field.Root data-testid="root" validationMode={validationMode} validate={validate}>
              <Field.Control data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>
          ));

          const root = screen.getByTestId('root');
          const control = screen.getByTestId('control');

          fireEvent.input(control, { target: { value: 'good' } });
          if (validationMode === 'onBlur') {
            fireEvent.blur(control);
          }

          await act(async () => {
            resolvers[0](null);
            await flushMicrotasks();
          });

          expect(root).toHaveAttribute('data-valid', '');

          if (validationMode === 'onBlur') {
            fireEvent.focus(control);
            fireEvent.blur(control);
          } else {
            fireEvent.input(control, { target: { value: 'taken' } });
          }

          // A valid result never blocks submission, so it retires to neutral mid-flight.
          expect(root).not.toHaveAttribute('data-valid');
          expect(root).not.toHaveAttribute('data-invalid');

          await act(async () => {
            resolvers[1]('Username is taken');
            await flushMicrotasks();
          });

          expect(root).toHaveAttribute('data-invalid', '');
          expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');
        });
      });

      (['onChange', 'onBlur'] as const).forEach((validationMode) => {
        it(`keeps a previously resolved error while revalidating in ${validationMode} mode`, async () => {
          const resolvers: Array<(value: string | null) => void> = [];
          const validate = vi.fn(
            () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve);
              }),
          );

          const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

          render(() => (
            <Form onSubmit={onSubmit}>
              <Field.Root
                data-testid="root"
                name="username"
                validationMode={validationMode}
                validate={validate}
              >
                <Field.Control data-testid="control" />
                <Field.Error data-testid="error" />
              </Field.Root>
              <button type="submit">submit</button>
            </Form>
          ));

          const root = screen.getByTestId('root');
          const control = screen.getByTestId('control');

          fireEvent.input(control, { target: { value: 'taken' } });
          if (validationMode === 'onBlur') {
            fireEvent.blur(control);
          }

          await act(async () => {
            resolvers[0]('Username is taken');
            await flushMicrotasks();
          });

          expect(root).toHaveAttribute('data-invalid', '');

          // A keystroke would optimistically clear the error through the revalidate path, so
          // re-trigger validation without changing the value.
          if (validationMode === 'onBlur') {
            fireEvent.focus(control);
            fireEvent.blur(control);
          } else {
            fireEvent.input(control, { target: { value: 'taken2' } });
          }

          // The resolved error stays published mid-flight so it keeps blocking submission.
          expect(root).toHaveAttribute('data-invalid', '');
          expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');

          fireEvent.click(screen.getByText('submit'));

          expect(onSubmit).not.toHaveBeenCalled();

          await act(async () => {
            resolvers[resolvers.length - 1](null);
            await flushMicrotasks();
          });

          expect(root).not.toHaveAttribute('data-invalid');
          expect(screen.queryByTestId('error')).toBe(null);
        });
      });

      it('retires a stale native error to neutral once the constraint passes again', async () => {
        const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
        const resolvers: Array<(value: string | null) => void> = [];
        const validate = vi.fn(
          () =>
            new Promise<string | null>((resolve) => {
              resolvers.push(resolve);
            }),
        );

        render(() => (
          <Form onSubmit={onSubmit}>
            <Field.Root
              data-testid="root"
              name="email"
              validationMode="onChange"
              validate={validate}
            >
              <Field.Control data-testid="control" type="email" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        fireEvent.input(control, { target: { value: 'nope' } });

        await act(async () => {
          resolvers[resolvers.length - 1](null);
          await flushMicrotasks();
        });

        expect(root).toHaveAttribute('data-invalid', '');

        fireEvent.input(control, { target: { value: 'name@example.com' } });

        // `nextState` already carries the fresh native verdict, so the previous native error must
        // not survive the pending window and keep blocking submission.
        expect(root).not.toHaveAttribute('data-invalid');
        expect(root).not.toHaveAttribute('data-valid');
        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.click(screen.getByText('submit'));

        expect(onSubmit).toHaveBeenCalledTimes(1);

        await act(async () => {
          resolvers[resolvers.length - 1](null);
          await flushMicrotasks();
        });

        expect(root).toHaveAttribute('data-valid', '');
      });

      (['onSubmit', 'onChange', 'onBlur'] as const).forEach((validationMode) => {
        it(`keeps a native constraint failure published while the validator is in flight in ${validationMode} mode`, async () => {
          const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
          const validate = vi.fn(() => new Promise<string | null>(() => {}));

          render(() => (
            <Form onSubmit={onSubmit}>
              <Field.Root
                data-testid="root"
                name="username"
                validationMode={validationMode}
                validate={validate}
              >
                <Field.Control data-testid="control" required />
                <Field.Error data-testid="error" />
              </Field.Root>
              <button type="submit">submit</button>
            </Form>
          ));

          fireEvent.click(screen.getByText('submit'));

          // In `onBlur` mode a native failure short-circuits the validator, so nothing is in
          // flight and the failure is published by the regular end-of-commit path instead.
          expect(validate).toHaveBeenCalledTimes(validationMode === 'onBlur' ? 0 : 1);
          expect(onSubmit).not.toHaveBeenCalled();
          expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');
          expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');

          await flushMicrotasks();
        });
      });

      it('retires a resolved async error to neutral while revalidating in onSubmit mode', async () => {
        const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
        const resolvers: Array<(value: string | null) => void> = [];
        const validate = vi.fn(
          () =>
            new Promise<string | null>((resolve) => {
              resolvers.push(resolve);
            }),
        );

        render(() => (
          <Form onSubmit={onSubmit}>
            <Field.Root data-testid="root" name="username" validate={validate}>
              <Field.Control data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        fireEvent.click(screen.getByText('submit'));

        await act(async () => {
          resolvers[0]('Username is taken');
          await flushMicrotasks();
        });

        expect(root).toHaveAttribute('data-invalid', '');

        fireEvent.click(screen.getByText('submit'));

        // An async result can't block submission in `onSubmit` mode, so the neutral state lets
        // the second submit through.
        expect(onSubmit).toHaveBeenCalledTimes(2);
        expect(root).not.toHaveAttribute('data-valid');
        expect(root).not.toHaveAttribute('data-invalid');
        expect(control).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        await act(async () => {
          resolvers[1](null);
          await flushMicrotasks();
        });

        expect(root).toHaveAttribute('data-valid', '');
        expect(screen.queryByTestId('error')).toBe(null);
      });
    });

    it('accepts synchronous and async validators with no return value', async () => {
      render(() => (
        <>
          <Field.Root data-testid="sync" validate={() => {}} />
          <Field.Root data-testid="async" validate={async () => {}} />
        </>
      ));

      expect(screen.getByTestId('sync')).toBeInTheDocument();
      expect(screen.getByTestId('async')).toBeInTheDocument();
    });

    it('should apply aria-invalid prop to control once validation finishes', () => {
      render(() => (
        <Form>
          <Field.Root validate={() => 'error'}>
            <Field.Control />
            <Field.Error />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const control = screen.getByRole('textbox');
      expect(control).not.to.have.attribute('aria-invalid');

      fireEvent.click(screen.getByText('submit'));
      expect(control).to.have.attribute('aria-invalid', 'true');
    });

    it('receives all form values as the 2nd argument', async () => {
      const validateSpy = spy();

      /**
       * For some reason, need to prevent default on submit so iframe is not
       * detached from the document in the vitest browser environment.
       */
      render(() => (
        <Form onSubmit={(e) => e.preventDefault()}>
          <Field.Root name="checkbox">
            <Checkbox.Root defaultChecked />
          </Field.Root>

          <Field.Root name="checkbox-group">
            <CheckboxGroup defaultValue={['apple', 'banana']}>
              <Field.Item>
                <Checkbox.Root value="apple" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="banana" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>

          <Field.Root name="input" validate={validateSpy}>
            <Field.Control data-testid="input" type="url" defaultValue="https://base-ui.com" />
          </Field.Root>

          <Field.Root name="number-field">
            <NumberField.Root defaultValue={13}>
              <NumberField.Input />
            </NumberField.Root>
          </Field.Root>

          <Field.Root name="radio-group">
            <RadioGroup defaultValue="cats">
              <Radio.Root value="cats" />
            </RadioGroup>
          </Field.Root>

          <Field.Root name="select">
            <Select.Root defaultValue="sans">
              <Select.Trigger />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="sans" />
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>

          <Field.Root name="slider">
            <Slider.Root defaultValue={12}>
              <Slider.Control />
            </Slider.Root>
          </Field.Root>

          <Field.Root name="range-slider">
            <Slider.Root defaultValue={[25, 70]}>
              <Slider.Control />
            </Slider.Root>
          </Field.Root>

          <Field.Root name="switch">
            <Switch.Root defaultChecked={false} />
          </Field.Root>

          <button type="submit">submit</button>
        </Form>
      ));

      fireEvent.click(screen.getByText('submit'));

      expect(validateSpy.callCount).to.equal(1);
      expect(validateSpy.firstCall.args[1]).to.deep.equal({
        checkbox: true,
        'checkbox-group': ['apple', 'banana'],
        input: 'https://base-ui.com',
        'number-field': 13,
        'radio-group': 'cats',
        'range-slider': [25, 70],
        select: 'sans',
        slider: 12,
        switch: false,
      });
    });

    it('unmounted fields are excluded from the validate fn', async () => {
      const validateSpy = spy();
      function App() {
        const [checked, setChecked] = createSignal(true);

        /**
         * For some reason, need to prevent default on submit so iframe is not
         * detached from the document in the vitest browser environment.
         */
        return (
          <Form onSubmit={(e) => e.preventDefault()}>
            <input type="checkbox" checked={checked()} onChange={() => setChecked(!checked())} />
            <Show when={checked()}>
              <Field.Root name="input1">
                <Field.Control defaultValue="one" />
              </Field.Root>
            </Show>
            <Field.Root name="input2" validate={validateSpy}>
              <Field.Control defaultValue="two" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        );
      }
      render(() => <App />);

      fireEvent.click(screen.getByText('submit'));

      expect(validateSpy.callCount).to.equal(1);
      expect(validateSpy.firstCall.args[1]).to.deep.equal({
        input1: 'one',
        input2: 'two',
      });

      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByText('submit'));

      expect(validateSpy.callCount).to.equal(2);
      expect(validateSpy.lastCall.args[1]).to.deep.equal({
        input2: 'two',
      });
    });

    it('submits the replacement control value when swapping field-aware controls', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [showSlider, setShowSlider] = createSignal(false);

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="value">
              <Show
                when={showSlider()}
                fallback={
                  <Select.Root defaultValue="sans">
                    <Select.Trigger />
                    <Select.Portal>
                      <Select.Positioner>
                        <Select.Popup>
                          <Select.Item value="sans" />
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                }
              >
                <Slider.Root defaultValue={12}>
                  <Slider.Control />
                </Slider.Root>
              </Show>
            </Field.Root>
            <button type="button" onClick={() => setShowSlider(true)}>
              Toggle
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      render(() => <App />);

      fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ value: 'sans' });

      fireEvent.click(screen.getByText('Toggle'));
      fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(2);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ value: 12 });
    });

    it('excludes registration-gated controls from onFormSubmit when their field name is removed', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [name, setName] = createSignal<string | undefined>('fruits');

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name={name()}>
              <CheckboxGroup defaultValue={['apple']}>
                <Field.Item>
                  <Checkbox.Root value="apple" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="banana" />
                </Field.Item>
              </CheckboxGroup>
            </Field.Root>
            <button type="button" onClick={() => setName(undefined)}>
              Clear name
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      render(() => <App />);

      fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });

      fireEvent.click(screen.getByText('Clear name'));
      fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(2);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
    });

    it('uses the Field.Control name for form submission and form validation values', async () => {
      const handleSubmit = vi.fn();
      const validate = vi.fn((_value: unknown, _formValues: Form.Values) => null);

      render(() => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root>
            <Field.Control name="email" defaultValue="one@example.com" />
          </Field.Root>
          <Field.Root name="confirmEmail" validate={validate}>
            <Field.Control defaultValue="one@example.com" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      fireEvent.click(screen.getByText('submit'));

      expect(validate.mock.lastCall?.[1]).toEqual({
        email: 'one@example.com',
        confirmEmail: 'one@example.com',
      });
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({
        email: 'one@example.com',
        confirmEmail: 'one@example.com',
      });
    });

    it('updates the Field.Control name fallback when the name changes', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [name, setName] = createSignal<string | undefined>('email');

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root>
              <Field.Control name={name()} defaultValue="one@example.com" />
            </Field.Root>
            <button type="button" onClick={() => setName('alternateEmail')}>
              Change name
            </button>
            <button type="button" onClick={() => setName(undefined)}>
              Clear name
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      render(() => <App />);

      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ email: 'one@example.com' });

      fireEvent.click(screen.getByText('Change name'));
      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({
        alternateEmail: 'one@example.com',
      });

      fireEvent.click(screen.getByText('Clear name'));
      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
    });

    it('uses the Field.Control name fallback when the Field.Root name is removed', async () => {
      function App() {
        const [rootName, setRootName] = createSignal<string | undefined>('rootEmail');

        return (
          <Form errors={{ email: 'Email is already taken' }}>
            <Field.Root name={rootName()}>
              <Field.Control name="email" />
              <Field.Error data-testid="default-error" />
            </Field.Root>
            <button type="button" onClick={() => setRootName(undefined)}>
              Clear root name
            </button>
          </Form>
        );
      }

      render(() => <App />);

      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('default-error')).toBe(null);

      fireEvent.click(screen.getByText('Clear root name'));

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('default-error')).toHaveTextContent('Email is already taken');
    });

    it('updates field-aware control name fallbacks when the name changes', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [name, setName] = createSignal<string | undefined>('quantity');

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root>
              <NumberField.Root name={name()} defaultValue={13}>
                <NumberField.Input />
              </NumberField.Root>
            </Field.Root>
            <button type="button" onClick={() => setName('amount')}>
              Change name
            </button>
            <button type="button" onClick={() => setName(undefined)}>
              Clear name
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      render(() => <App />);

      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ quantity: 13 });

      fireEvent.click(screen.getByText('Change name'));
      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ amount: 13 });

      fireEvent.click(screen.getByText('Clear name'));
      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
    });
  });

  describe('prop: validationMode', () => {
    describe('onSubmit', () => {
      it('should validate the field on submit', () => {
        render(() => (
          <Form>
            <Field.Root validate={() => 'error'}>
              <Field.Control />
              <Field.Error />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const message = screen.queryByText('error');

        expect(message).to.equal(null);

        fireEvent.click(screen.getByText('submit'));

        expect(screen.queryByText('error')).not.to.equal(null);
      });

      it('revalidates on change', () => {
        render(() => (
          <Form>
            <Field.Root>
              <Field.Control type="url" required defaultValue="" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const control = screen.getByRole<HTMLInputElement>('textbox');

        expect(screen.queryByTestId('error')).to.equal(null);

        fireEvent.click(screen.getByText('submit'));
        expect(screen.queryByTestId('error')).not.to.equal(null);

        fireEvent.input(control, { target: { value: 'http://example' } });
        expect(screen.queryByTestId('error')).to.equal(null);
      });
    });

    describe('onChange', () => {
      it('validates the field on change', async () => {
        render(() => (
          <Field.Root
            validationMode="onChange"
            validate={(value) => {
              const str = value as string;
              return str.length < 3 ? 'error' : null;
            }}
          >
            <Field.Control />
            <Field.Error />
          </Field.Root>
        ));

        const control = screen.getByRole<HTMLInputElement>('textbox');
        const message = screen.queryByText('error');

        expect(message).to.equal(null);

        fireEvent.input(control, { target: { value: 't' } });

        expect(control).to.have.attribute('data-invalid', '');
        expect(control).to.have.attribute('aria-invalid', 'true');
      });
    });

    describe('onBlur', () => {
      it('validates the field on blur', async () => {
        render(() => (
          <Field.Root
            validationMode="onBlur"
            validate={(value) => {
              const str = value as string;
              return str.length < 3 ? 'error' : null;
            }}
          >
            <Field.Control />
            <Field.Error />
          </Field.Root>
        ));

        const control = screen.getByRole<HTMLInputElement>('textbox');
        const message = screen.queryByText('error');

        expect(message).to.equal(null);

        fireEvent.input(control, { target: { value: 't' } });

        expect(control).not.to.have.attribute('data-invalid');

        fireEvent.blur(control);

        expect(control).to.have.attribute('data-invalid', '');
        expect(control).to.have.attribute('aria-invalid', 'true');
      });

      it('should not mark invalid if `valueMissing` is the only error and not yet dirtied', () => {
        render(() => (
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = screen.getByTestId('control');

        fireEvent.focus(control);
        fireEvent.blur(control);

        expect(control).not.to.have.attribute('data-invalid');
        expect(control).not.to.have.attribute('aria-invalid');
      });

      it('does not publish errors while `valueMissing` is suppressed', async () => {
        let latestValidity: Field.Validity.State | null = null;

        render(() => (
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
            <Field.Validity>
              {(validity) => {
                latestValidity = validity;
                return null;
              }}
            </Field.Validity>
          </Field.Root>
        ));

        const control = screen.getByTestId('control');

        fireEvent.focus(control);
        fireEvent.blur(control);

        expect(latestValidity!.validity.valid).toBe(true);
        expect(latestValidity!.errors).toEqual([]);
        expect(latestValidity!.error).toBe('');
      });

      it('should mark invalid if `valueMissing` is the only error and dirtied', async () => {
        render(() => (
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = screen.getByTestId('control');

        fireEvent.focus(control);
        fireEvent.input(control, { target: { value: 'a' } });
        fireEvent.input(control, { target: { value: '' } });
        fireEvent.blur(control);

        expect(control).to.have.attribute('data-invalid', '');
        expect(control).to.have.attribute('aria-invalid', 'true');
      });

      it('supports async validation', async () => {
        render(() => (
          <Field.Root validationMode="onBlur" validate={() => Promise.resolve('error')}>
            <Field.Control />
            <Field.Error />
          </Field.Root>
        ));

        const control = screen.getByRole('textbox');
        const message = screen.queryByText('error');

        expect(message).to.equal(null);

        fireEvent.focus(control);
        fireEvent.blur(control);

        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByText('error')).not.to.equal(null);
        });
      });

      it('ignores stale async validation results', async () => {
        const resolvers: Record<string, (value: string | null) => void> = {};
        const validate = vi.fn((value) => {
          return new Promise<string | null>((resolve) => {
            resolvers[value as string] = resolve;
          });
        });

        render(() => (
          <Field.Root validationMode="onChange" validate={validate}>
            <Field.Control />
            <Field.Error />
          </Field.Root>
        ));

        const control = screen.getByRole<HTMLInputElement>('textbox');

        fireEvent.input(control, { target: { value: 'old' } });
        fireEvent.input(control, { target: { value: 'new' } });

        await act(async () => {
          resolvers.new(null);
          await flushMicrotasks();
        });

        expect(screen.queryByText('old error')).toBe(null);
        expect(control).not.toHaveAttribute('aria-invalid');

        await act(async () => {
          resolvers.old('old error');
          await flushMicrotasks();
        });

        expect(screen.queryByText('old error')).toBe(null);
        expect(control).not.toHaveAttribute('aria-invalid');
      });

      it('should apply [data-field] style hooks to field components', () => {
        render(() => (
          <Field.Root validationMode="onBlur">
            <Field.Label data-testid="label">Label</Field.Label>
            <Field.Description data-testid="description">Description</Field.Description>
            <Field.Error data-testid="error" />
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = screen.getByTestId<HTMLInputElement>('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');
        let error = screen.queryByTestId('error');

        expect(control).not.to.have.attribute('data-valid');
        expect(label).not.to.have.attribute('data-valid');
        expect(description).not.to.have.attribute('data-valid');
        expect(error).to.equal(null);

        fireEvent.focus(control);
        fireEvent.input(control, { target: { value: 'a' } });
        fireEvent.input(control, { target: { value: '' } });
        fireEvent.blur(control);

        error = screen.getByTestId('error');

        expect(control).to.have.attribute('data-invalid', '');
        expect(label).to.have.attribute('data-invalid', '');
        expect(description).to.have.attribute('data-invalid', '');
        expect(error).to.have.attribute('data-invalid', '');

        act(() => {
          control.value = 'value';
          control.focus();
          control.blur();
        });

        error = screen.queryByTestId('error');

        expect(control).to.have.attribute('data-valid', '');
        expect(label).to.have.attribute('data-valid', '');
        expect(description).to.have.attribute('data-valid', '');
        expect(error).to.equal(null);
      });

      describe('revalidation', () => {
        it('revalidates on change for `valueMissing`', async () => {
          render(() => (
            <Field.Root validationMode="onBlur">
              <Field.Control required />
              <Field.Error />
            </Field.Root>
          ));

          const control = screen.getByRole('textbox');
          const message = screen.queryByText('error');

          expect(message).to.equal(null);

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: 't' } });
          fireEvent.blur(control);

          expect(control).not.to.have.attribute('aria-invalid', 'true');

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: '' } });
          fireEvent.blur(control);

          expect(control).to.have.attribute('aria-invalid');
        });

        it('handles both `required` and `typeMismatch`', async () => {
          render(() => (
            <Field.Root validationMode="onBlur">
              <Field.Control type="email" required />
              <Field.Error data-testid="error" />
            </Field.Root>
          ));

          const control = screen.getByRole('textbox');
          const message = screen.queryByTestId('error');

          expect(message).to.equal(null);

          fireEvent.focus(control);
          fireEvent.blur(control);

          expect(control).not.to.have.attribute('aria-invalid');

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: 'tt' } });
          fireEvent.blur(control);

          expect(control).to.have.attribute('aria-invalid', 'true');

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: '' } });
          fireEvent.blur(control);

          expect(control).to.have.attribute('aria-invalid', 'true');

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: 'email@email.com' } });
          fireEvent.blur(control);

          expect(control).not.to.have.attribute('aria-invalid');
        });

        it('revalidates on change when clearing a type mismatch leaves only `valueMissing`', async () => {
          render(() => (
            <Field.Root validationMode="onBlur">
              <Field.Control type="email" required data-testid="control" />
              <Field.Error match="typeMismatch" data-testid="type-error">
                Invalid email
              </Field.Error>
              <Field.Error match="valueMissing" data-testid="required-error">
                Required
              </Field.Error>
            </Field.Root>
          ));

          const control = screen.getByTestId('control');

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: 'invalid' } });
          fireEvent.blur(control);

          expect(screen.getByTestId('type-error')).not.toBe(null);
          expect(screen.queryByTestId('required-error')).toBe(null);

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: '' } });

          expect(screen.queryByTestId('type-error')).toBe(null);
          expect(screen.getByTestId('required-error')).not.toBe(null);
        });

        it('clears valueMissing on change but defers other native errors like typeMismatch until blur when both are active', async () => {
          render(() => (
            <Field.Root validationMode="onBlur">
              <Field.Control type="email" required data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>
          ));

          const control = screen.getByTestId('control');

          fireEvent.focus(control);
          fireEvent.blur(control);
          expect(control).not.to.have.attribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).to.equal(null);

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: 'a' } });
          fireEvent.input(control, { target: { value: '' } });
          fireEvent.blur(control);

          expect(control).to.have.attribute('aria-invalid', 'true');
          expect(screen.getByTestId('error')).not.to.equal(null);

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: 't' } });

          // The field becomes temporarily valid because only 'valueMissing' is checked for immediate clearing.
          // Other errors like 'typeMismatch' are deferred to the next blur/submit.
          expect(control).not.to.have.attribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).to.equal(null);

          fireEvent.blur(control);

          expect(control).to.have.attribute('aria-invalid', 'true');
          expect(screen.getByTestId('error')).not.to.equal(null);
          expect(screen.getByTestId('error').textContent).not.to.equal('');

          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: 'test@example.com' } });

          expect(control).not.to.have.attribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).to.equal(null);

          fireEvent.blur(control);

          expect(control).not.to.have.attribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).to.equal(null);
        });
      });

      describe('computed validity state', () => {
        it('should not mark field as invalid for valueMissing if not dirty', () => {
          render(() => (
            <Field.Root validationMode="onBlur">
              <Field.Control data-testid="control" required />
            </Field.Root>
          ));

          const control = screen.getByTestId('control');

          fireEvent.focus(control);
          fireEvent.blur(control);

          expect(control).not.to.have.attribute('data-invalid');
          expect(control).not.to.have.attribute('aria-invalid');
        });

        it('should mark field as invalid for valueMissing if dirty', () => {
          render(() => (
            <Field.Root validationMode="onBlur">
              <Field.Control data-testid="control" required />
            </Field.Root>
          ));

          const control = screen.getByTestId('control');

          // Mark as touched and dirtied
          fireEvent.focus(control);
          fireEvent.input(control, { target: { value: 'a' } });
          fireEvent.input(control, { target: { value: '' } });
          fireEvent.blur(control);

          // valueMissing is true, and markedDirtyRef is true, so valid should be false
          expect(control).to.have.attribute('data-invalid', '');
          expect(control).to.have.attribute('aria-invalid', 'true');
        });

        it('should mark field as invalid for other errors (e.g., typeMismatch) even if not dirty', () => {
          render(() => (
            <Field.Root validationMode="onBlur">
              <Field.Control data-testid="control" type="email" defaultValue="not_an_email@" />
            </Field.Root>
          ));

          const control = screen.getByTestId('control');

          // Mark as touched but not dirty
          fireEvent.focus(control);
          fireEvent.blur(control);

          // typeMismatch is true, so valid should be false regardless of dirty state
          expect(control).to.have.attribute('data-invalid', '');
          expect(control).to.have.attribute('aria-invalid', 'true');
        });
      });
    });
  });

  describe('prop: validateDebounceTime', () => {
    const { clock, render: renderFakeTimers } = createRenderer();

    clock.withFakeTimers();

    it('should debounce validation', async () => {
      renderFakeTimers(() => (
        <Field.Root
          validationDebounceTime={100}
          validationMode="onChange"
          validate={(value) => {
            const str = value as string;
            return str.length < 3 ? 'error' : null;
          }}
        >
          <Field.Control />
          <Field.Error />
        </Field.Root>
      ));

      const control = screen.getByRole<HTMLInputElement>('textbox');
      const message = screen.queryByText('error');

      expect(message).to.equal(null);

      fireEvent.input(control, { target: { value: 't' } });

      expect(control).not.to.have.attribute('aria-invalid');

      clock.tick(99);

      fireEvent.input(control, { target: { value: 'te' } });

      clock.tick(99);

      expect(control).not.to.have.attribute('aria-invalid');

      clock.tick(1);

      expect(control).to.have.attribute('aria-invalid', 'true');
      expect(screen.queryByText('error')).not.to.equal(null);
    });

    it('should debounce validation for field-aware controls', async () => {
      const validate = vi.fn((value) => (value ? 'error' : null));

      renderFakeTimers(() => (
        <Field.Root validationDebounceTime={100} validationMode="onChange" validate={validate}>
          <Checkbox.Root />
          <Field.Error />
        </Field.Root>
      ));

      const control = screen.getByRole('checkbox');

      fireEvent.click(control);

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(99);

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(1);

      expect(validate).toHaveBeenCalledTimes(1);
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('error')).not.toBe(null);
    });

    it('should debounce validation for radio groups', async () => {
      const validate = vi.fn((value) => (value === 'b' ? 'error' : null));

      renderFakeTimers(() => (
        <Field.Root validationDebounceTime={100} validationMode="onChange" validate={validate}>
          <RadioGroup>
            <Radio.Root value="a" data-testid="item-a" />
            <Radio.Root value="b" data-testid="item-b" />
          </RadioGroup>
          <Field.Error />
        </Field.Root>
      ));

      const control = screen.getByRole('radiogroup');

      fireEvent.click(screen.getByTestId('item-b'));

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(99);

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(1);

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe('b');
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('error')).not.toBe(null);
    });

    it('drops a pending debounced validation when the control unmounts', async () => {
      const validate = vi.fn(() => 'error');

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <div>
            <Field.Root
              data-testid="root"
              validationDebounceTime={100}
              validationMode="onChange"
              validate={validate}
            >
              <Show when={mounted()}>
                <Field.Control data-testid="control" />
              </Show>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="button" onClick={() => setMounted(false)}>
              unmount
            </button>
          </div>
        );
      }

      renderFakeTimers(() => <App />);

      fireEvent.input(screen.getByTestId('control'), { target: { value: 'abc' } });

      clock.tick(99);

      fireEvent.click(screen.getByText('unmount'));

      clock.tick(100);

      expect(validate).not.toHaveBeenCalled();
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
    });

    it('ignores async validation results superseded during debounce', async () => {
      const resolvers: Record<string, (value: string | null) => void> = {};
      const validate = vi.fn((value) => {
        return new Promise<string | null>((resolve) => {
          resolvers[value as string] = resolve;
        });
      });

      renderFakeTimers(() => (
        <Field.Root validationDebounceTime={100} validationMode="onChange" validate={validate}>
          <Field.Control />
          <Field.Error />
        </Field.Root>
      ));

      const control = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.input(control, { target: { value: 'old' } });
      clock.tick(100);

      expect(validate.mock.lastCall?.[0]).toBe('old');

      fireEvent.input(control, { target: { value: 'new' } });

      await act(async () => {
        resolvers.old('old error');
        await flushMicrotasks();
      });

      expect(screen.queryByText('old error')).toBe(null);
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(100);

      await act(async () => {
        resolvers.new(null);
        await flushMicrotasks();
      });

      expect(validate.mock.lastCall?.[0]).toBe('new');
      expect(screen.queryByText('old error')).toBe(null);
      expect(control).not.toHaveAttribute('aria-invalid');
    });

    it('drops an in-flight async validation when the control unmounts', async () => {
      let resolveValidate: ((value: string | null) => void) | undefined;
      const validate = vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            resolveValidate = resolve;
          }),
      );

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <div>
            <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
              <Show when={mounted()}>
                <Field.Control data-testid="control" />
              </Show>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="button" onClick={() => setMounted(false)}>
              unmount
            </button>
          </div>
        );
      }

      render(() => <App />);

      fireEvent.input(screen.getByTestId('control'), { target: { value: 'abc' } });
      expect(validate).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('unmount'));

      await act(async () => {
        resolveValidate?.('error');
        await flushMicrotasks();
      });

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
    });

    it('keeps the published error when async validation rejects', async () => {
      const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
      let commit: ((value: unknown) => Promise<void>) | undefined;

      function ReadCommit() {
        commit = useFieldRootContext().validation.commit;
        return null;
      }

      let calls = 0;
      const validate = async () => {
        calls += 1;
        if (calls === 2) {
          throw new Error('network');
        }
        return 'Username is taken';
      };

      render(() => (
        <Form onSubmit={onSubmit}>
          <Field.Root name="username" validationMode="onBlur" validate={validate}>
            <Field.Control data-testid="control" />
            <Field.Error data-testid="error" />
            <ReadCommit />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const control = screen.getByTestId('control');

      fireEvent.focus(control);
      fireEvent.input(control, { target: { value: 'taken' } });
      fireEvent.blur(control);
      await flushMicrotasks();

      expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');

      await expect(commit?.('taken')).rejects.toThrow('network');

      expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');
      expect(control).toHaveAttribute('aria-invalid', 'true');

      fireEvent.click(screen.getByText('submit'));
      await flushMicrotasks();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('drops a pending validation when another field-aware control takes ownership', async () => {
      const validate = vi.fn(() => 'error');

      function App() {
        const [showSwitch, setShowSwitch] = createSignal(false);

        return (
          <div>
            <Field.Root
              data-testid="root"
              validationDebounceTime={100}
              validationMode="onChange"
              validate={validate}
            >
              <Field.Control data-testid="control" />
              <Show when={showSwitch()}>
                <Switch.Root />
              </Show>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="button" onClick={() => setShowSwitch(true)}>
              add switch
            </button>
          </div>
        );
      }

      renderFakeTimers(() => <App />);

      fireEvent.input(screen.getByTestId('control'), { target: { value: 'abc' } });

      clock.tick(99);

      fireEvent.click(screen.getByText('add switch'));

      clock.tick(100);

      expect(validate).not.toHaveBeenCalled();
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
    });

    it('keeps a pending debounce armed across the first registration', async () => {
      const validate = vi.fn(() => 'error');

      renderFakeTimers(() => (
        <Field.Root
          data-testid="root"
          validationDebounceTime={100}
          validationMode="onChange"
          validate={validate}
        >
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      fireEvent.input(screen.getByTestId('control'), { target: { value: 'abc' } });

      clock.tick(100);

      expect(validate).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('error')).toHaveTextContent('error');
    });
  });

  describe('custom validity ownership', () => {
    it('keeps a message set outside the field when submitting', async () => {
      const onFormSubmit = vi.fn();

      render(() => (
        <Form onFormSubmit={onFormSubmit}>
          <Field.Root name="external">
            <Field.Control data-testid="control" />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      fireEvent.click(screen.getByText('submit'));

      expect(onFormSubmit).not.toHaveBeenCalled();
      expect(control.validationMessage).toBe('external error');
      expect(screen.getByTestId('error')).toHaveTextContent('external error');
    });

    it('keeps a message set outside the field when validating on change', async () => {
      render(() => (
        <Field.Root validationMode="onChange">
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      fireEvent.input(control, { target: { value: 'abc' } });

      expect(control.validationMessage).toBe('external error');
      expect(control).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('error')).toHaveTextContent('external error');
    });

    it('keeps a message set outside the field when revalidating on change', async () => {
      render(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control data-testid="control" required />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const control = screen.getByTestId<HTMLInputElement>('control');

      fireEvent.focus(control);
      fireEvent.input(control, { target: { value: 'a' } });
      fireEvent.input(control, { target: { value: '' } });
      fireEvent.blur(control);
      expect(control).toHaveAttribute('data-invalid', '');

      control.setCustomValidity('external error');
      fireEvent.input(control, { target: { value: 'abc' } });

      expect(control.validationMessage).toBe('external error');
      expect(control).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('error')).toHaveTextContent('external error');
    });

    it('keeps other native errors deferred while a message set outside the field survives', async () => {
      const handleValidity = vi.fn();
      render(() => (
        <Field.Root name="field" validationMode="onBlur">
          <Field.Control type="email" required />
          <Field.Error match="typeMismatch" data-testid="type-mismatch">
            invalid email
          </Field.Error>
          <Field.Validity>{handleValidity}</Field.Validity>
        </Field.Root>
      ));

      const control = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.focus(control);
      fireEvent.input(control, { target: { value: 'a' } });
      fireEvent.input(control, { target: { value: '' } });
      fireEvent.blur(control);
      expect(control).toHaveAttribute('data-invalid', '');

      control.setCustomValidity('external error');
      fireEvent.input(control, { target: { value: 'abc' } });

      expect(screen.queryByTestId('type-mismatch')).toBe(null);
      expect(handleValidity.mock.lastCall?.[0].validity.typeMismatch).toBe(false);
      expect(handleValidity.mock.lastCall?.[0].validity.customError).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(false);
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(['external error']);
    });

    it('clears the message it set itself', async () => {
      render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => (value === 'bad' ? 'custom error\r\nmore' : null)}
        >
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const control = screen.getByTestId<HTMLInputElement>('control');

      fireEvent.input(control, { target: { value: 'bad' } });

      expect(control.validationMessage).toBe('custom error\nmore');

      fireEvent.input(control, { target: { value: 'good' } });

      expect(control.validationMessage).toBe('');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('restores a message its own one displaced', async () => {
      render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => (value === 'bad' ? 'custom error' : null)}
        >
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      fireEvent.input(control, { target: { value: 'bad' } });

      expect(control.validationMessage).toBe('custom error');

      fireEvent.input(control, { target: { value: 'good' } });

      expect(control.validationMessage).toBe('external error');
      expect(screen.getByTestId('error')).toHaveTextContent('external error');
    });

    it('does not restore a message that was withdrawn while its own one was installed', async () => {
      render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => (value === 'bad' ? 'custom error' : null)}
        >
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      fireEvent.input(control, { target: { value: 'bad' } });

      expect(control.validationMessage).toBe('custom error');

      control.setCustomValidity('');

      fireEvent.input(control, { target: { value: 'good' } });

      expect(control.validationMessage).toBe('');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('clears its own message on an input that became disabled', async () => {
      function App() {
        const actionsRef = useRef<Field.Root.Actions | null>(null);
        const [disabled, setDisabled] = createSignal(false);
        const [failing, setFailing] = createSignal(true);

        return (
          <div>
            <Field.Root
              actionsRef={actionsRef}
              validate={() => (failing() ? 'custom error' : null)}
            >
              <Field.Control data-testid="control" disabled={disabled()} />
            </Field.Root>
            <button type="button" onClick={() => actionsRef.current?.validate()}>
              validate
            </button>
            <button type="button" onClick={() => setDisabled((prev) => !prev)}>
              toggle disabled
            </button>
            <button type="button" onClick={() => setFailing(false)}>
              pass
            </button>
          </div>
        );
      }

      render(() => <App />);

      const control = screen.getByTestId<HTMLInputElement>('control');

      fireEvent.click(screen.getByText('validate'));

      expect(control.validationMessage).toBe('custom error');

      fireEvent.click(screen.getByText('toggle disabled'));
      fireEvent.click(screen.getByText('pass'));
      fireEvent.click(screen.getByText('validate'));
      fireEvent.click(screen.getByText('toggle disabled'));

      expect(control.validationMessage).toBe('');
    });

    it('does not adopt a native message as the message it displaced', async () => {
      render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => (value === 'bad' ? 'custom error' : null)}
        >
          <Field.Control data-testid="control" type="email" />
        </Field.Root>
      ));

      const control = screen.getByTestId<HTMLInputElement>('control');

      fireEvent.input(control, { target: { value: 'bad' } });
      expect(control.validationMessage).toBe('custom error');

      fireEvent.input(control, { target: { value: 'a@b.co' } });

      expect(control.validity.customError).toBe(false);
      expect(control.validationMessage).toBe('');
    });

    it('keeps a message set outside the field on another input of the same field', async () => {
      const handleValidity = vi.fn();

      function App() {
        const actionsRef = useRef<Field.Root.Actions | null>(null);

        return (
          <div>
            <Field.Root
              actionsRef={actionsRef}
              validationMode="onBlur"
              validate={(value) => (value === 'cats' ? 'custom error' : null)}
            >
              <RadioGroup defaultValue="cats">
                <Radio.Root value="cats" data-testid="cats" />
                <Radio.Root value="dogs" data-testid="dogs" />
              </RadioGroup>
              <Field.Validity>{handleValidity}</Field.Validity>
            </Field.Root>
            <button type="button" onClick={() => actionsRef.current?.validate()}>
              validate
            </button>
          </div>
        );
      }

      render(() => <App />);

      const [cats, dogs] = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');

      fireEvent.click(screen.getByText('validate'));
      expect(cats.validationMessage).toBe('custom error');

      dogs.setCustomValidity('external error');
      fireEvent.click(screen.getByTestId('dogs'));

      expect(cats.validationMessage).toBe('');
      expect(dogs.validationMessage).toBe('external error');
      expect(handleValidity.mock.lastCall?.[0].validity.customError).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(['external error']);
    });

    it.skipIf(isJSDOM)(
      'ignores a message set outside the field on a control barred from validation',
      async () => {
        const onFormSubmit = vi.fn();

        render(() => (
          <Form onFormSubmit={onFormSubmit}>
            <Field.Root name="field" validationMode="onChange">
              <Field.Control data-testid="control" readonly />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const control = screen.getByTestId<HTMLInputElement>('control');
        expect(control.willValidate).toBe(false);
        control.setCustomValidity('external error');

        fireEvent.input(control, { target: { value: 'abc' } });

        expect(control).not.toHaveAttribute('data-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.click(screen.getByText('submit'));

        expect(onFormSubmit).toHaveBeenCalledTimes(1);
      },
    );

    it.skipIf(isJSDOM)('does not write its own message to a barred control', async () => {
      function App() {
        const [readOnly, setReadOnly] = createSignal(true);

        return (
          <div>
            <Field.Root validationMode="onChange" validate={() => 'custom error'}>
              <Field.Control data-testid="control" readonly={readOnly()} />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="button" onClick={() => setReadOnly(false)}>
              make editable
            </button>
          </div>
        );
      }

      render(() => <App />);

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      fireEvent.input(control, { target: { value: 'abc' } });

      expect(screen.getByTestId('error')).toHaveTextContent('custom error');

      fireEvent.click(screen.getByText('make editable'));

      expect(control.validationMessage).toBe('external error');
    });
  });

  describe('style hooks', () => {
    describe('touched', () => {
      it('should apply [data-touched] style hook to all components when touched', async () => {
        render(() => (
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');
        const error = screen.queryByTestId('error');

        expect(root).not.to.have.attribute('data-touched');
        expect(control).not.to.have.attribute('data-touched');
        expect(label).not.to.have.attribute('data-touched');
        expect(description).not.to.have.attribute('data-touched');
        expect(error).to.equal(null);

        fireEvent.focus(control);
        fireEvent.blur(control);

        expect(root).to.have.attribute('data-touched', '');
        expect(control).to.have.attribute('data-touched', '');
        expect(label).to.have.attribute('data-touched', '');
        expect(description).to.have.attribute('data-touched', '');
        expect(error).to.equal(null);
      });
    });

    describe('dirty', () => {
      it('should apply [data-dirty] style hook to all components when dirty', async () => {
        render(() => (
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.to.have.attribute('data-dirty');
        expect(control).not.to.have.attribute('data-dirty');
        expect(label).not.to.have.attribute('data-dirty');
        expect(description).not.to.have.attribute('data-dirty');

        fireEvent.input(control, { target: { value: 'value' } });

        expect(root).to.have.attribute('data-dirty', '');
        expect(control).to.have.attribute('data-dirty', '');
        expect(label).to.have.attribute('data-dirty', '');
        expect(description).to.have.attribute('data-dirty', '');

        fireEvent.input(control, { target: { value: '' } });

        expect(root).not.to.have.attribute('data-dirty');
        expect(control).not.to.have.attribute('data-dirty');
        expect(label).not.to.have.attribute('data-dirty');
        expect(description).not.to.have.attribute('data-dirty');
      });

      it('should clear [data-dirty] when a null-valued control returns to its empty initial value', async () => {
        render(() => (
          <Field.Root data-testid="root">
            <NumberField.Root>
              <NumberField.Input data-testid="control" />
            </NumberField.Root>
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        expect(root).not.toHaveAttribute('data-dirty');

        fireEvent.input(control, { target: { value: '5' } });
        await waitFor(() => {
          expect(root).toHaveAttribute('data-dirty', '');
        });

        fireEvent.input(control, { target: { value: '' } });
        await waitFor(() => {
          expect(root).not.toHaveAttribute('data-dirty');
        });
      });

      it('should clear [data-dirty] when a Select returns to its null initial value', async () => {
        function App() {
          const [value, setValue] = createSignal<string | null>(null);
          return (
            <div>
              <Field.Root data-testid="root">
                <Select.Root value={value()} onValueChange={setValue}>
                  <Select.Trigger />
                  <Select.Portal>
                    <Select.Positioner>
                      <Select.Popup>
                        <Select.Item value="a" />
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </Field.Root>
              <button type="button" onClick={() => setValue('a')}>
                set
              </button>
              <button type="button" onClick={() => setValue(null)}>
                clear
              </button>
            </div>
          );
        }

        render(() => <App />);
        const root = screen.getByTestId('root');

        expect(root).not.toHaveAttribute('data-dirty');

        fireEvent.click(screen.getByText('set'));
        await waitFor(() => {
          expect(root).toHaveAttribute('data-dirty', '');
        });

        fireEvent.click(screen.getByText('clear'));
        await waitFor(() => {
          expect(root).not.toHaveAttribute('data-dirty');
        });
      });

      it('keeps [data-dirty] on a RadioGroup when returning to the first picked value', async () => {
        function App() {
          const [value, setValue] = createSignal<string | null>(null);
          return (
            <div>
              <Field.Root data-testid="root">
                <RadioGroup
                  value={value()}
                  onValueChange={(next) => setValue(next as string | null)}
                >
                  <Radio.Root value="a" />
                  <Radio.Root value="b" />
                </RadioGroup>
              </Field.Root>
              <button type="button" onClick={() => setValue('a')}>
                a
              </button>
              <button type="button" onClick={() => setValue('b')}>
                b
              </button>
            </div>
          );
        }

        render(() => <App />);
        const root = screen.getByTestId('root');

        expect(root).not.toHaveAttribute('data-dirty');

        fireEvent.click(screen.getByText('a'));
        await waitFor(() => {
          expect(root).toHaveAttribute('data-dirty', '');
        });

        fireEvent.click(screen.getByText('b'));
        fireEvent.click(screen.getByText('a'));

        await waitFor(() => {
          expect(root).toHaveAttribute('data-dirty', '');
        });
      });
    });

    describe('control remount', () => {
      it('clears dirty after an empty text control returns to empty following a null-valued control', async () => {
        render(() => (
          <SwappableField
            data-testid="root"
            firstControl={
              <NumberField.Root>
                <NumberField.Input />
              </NumberField.Root>
            }
            secondControl={<Field.Control data-testid="control" defaultValue="" />}
          />
        ));
        const root = screen.getByTestId('root');

        fireEvent.click(screen.getByText('swap'));
        const control = screen.getByTestId('control');
        expect(root).not.toHaveAttribute('data-dirty');

        fireEvent.input(control, { target: { value: 'x' } });
        expect(root).toHaveAttribute('data-dirty', '');

        fireEvent.input(control, { target: { value: '' } });
        expect(root).not.toHaveAttribute('data-dirty');
      });

      it('keeps the original baseline when a controlled control remounts', async () => {
        function App() {
          const [value, setValue] = createSignal('a');
          const [mounted, setMounted] = createSignal(true);
          return (
            <div>
              <Field.Root data-testid="root">
                <Show when={mounted()}>
                  <Field.Control data-testid="control" value={value()} onValueChange={setValue} />
                </Show>
              </Field.Root>
              <button type="button" onClick={() => setMounted((prev) => !prev)}>
                toggle
              </button>
            </div>
          );
        }

        render(() => <App />);
        const root = screen.getByTestId('root');

        fireEvent.input(screen.getByTestId('control'), { target: { value: 'b' } });
        await waitFor(() => {
          expect(root).toHaveAttribute('data-dirty', '');
        });

        fireEvent.click(screen.getByText('toggle'));
        fireEvent.click(screen.getByText('toggle'));

        expect(root).toHaveAttribute('data-dirty', '');

        fireEvent.input(screen.getByTestId('control'), { target: { value: 'a' } });
        await waitFor(() => {
          expect(root).not.toHaveAttribute('data-dirty');
        });
      });

      it('keeps the field baseline when the control is swapped', async () => {
        render(() => (
          <SwappableField
            data-testid="root"
            firstControl={<Field.Control defaultValue="a" />}
            secondControl={<Field.Control data-testid="control" defaultValue="x" />}
          />
        ));
        const root = screen.getByTestId('root');

        fireEvent.click(screen.getByText('swap'));
        const control = screen.getByTestId('control');

        fireEvent.input(control, { target: { value: 'y' } });
        await waitFor(() => {
          expect(root).toHaveAttribute('data-dirty', '');
        });

        // The baseline is still the field's original value, not the swapped-in control's default.
        fireEvent.input(control, { target: { value: 'a' } });
        await waitFor(() => {
          expect(root).not.toHaveAttribute('data-dirty');
        });
      });

      // Solid: there is no Strict Mode double mount; the baseline is captured on first registration.
      it('captures the baseline only once in StrictMode', async () => {
        render(() => (
          <Field.Root data-testid="root">
            <NumberField.Root>
              <NumberField.Input data-testid="control" />
            </NumberField.Root>
          </Field.Root>
        ));
        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        fireEvent.input(control, { target: { value: '5' } });
        await waitFor(() => {
          expect(root).toHaveAttribute('data-dirty', '');
        });

        fireEvent.input(control, { target: { value: '' } });
        await waitFor(() => {
          expect(root).not.toHaveAttribute('data-dirty');
        });
      });
    });

    describe('filled', () => {
      it('should apply [data-filled] style hook to all components when filled', () => {
        render(() => (
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.to.have.attribute('data-filled');
        expect(control).not.to.have.attribute('data-filled');
        expect(label).not.to.have.attribute('data-filled');
        expect(description).not.to.have.attribute('data-filled');

        fireEvent.input(control, { target: { value: 'value' } });

        expect(root).to.have.attribute('data-filled', '');
        expect(control).to.have.attribute('data-filled', '');
        expect(label).to.have.attribute('data-filled', '');
        expect(description).to.have.attribute('data-filled', '');

        fireEvent.input(control, { target: { value: '' } });

        expect(root).not.to.have.attribute('data-filled');
        expect(control).not.to.have.attribute('data-filled');
        expect(label).not.to.have.attribute('data-filled');
        expect(description).not.to.have.attribute('data-filled');
      });

      it('changes [data-filled] when the value is changed externally', async () => {
        function App() {
          const [value, setValue] = createSignal('');
          return (
            <div>
              <Field.Root>
                <Field.Control value={value()} onChange={(event) => setValue(event.target.value)} />
              </Field.Root>
              <button onClick={() => setValue('test')}>change</button>
              <button onClick={() => setValue('')}>reset</button>
            </div>
          );
        }

        const { user } = render(() => <App />);

        expect(screen.getByRole('textbox')).not.to.have.attribute('data-filled', '');

        await user.click(screen.getByRole('button', { name: 'change' }));
        expect(screen.getByRole('textbox')).to.have.attribute('data-filled', '');

        await user.click(screen.getByRole('button', { name: 'reset' }));
        expect(screen.getByRole('textbox')).not.to.have.attribute('data-filled', '');
      });
    });

    describe('focused', () => {
      it('should apply [data-focused] style hook to all components when focused', async () => {
        render(() => (
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.to.have.attribute('data-focused');
        expect(control).not.to.have.attribute('data-focused');
        expect(label).not.to.have.attribute('data-focused');
        expect(description).not.to.have.attribute('data-focused');

        fireEvent.focus(control);

        expect(root).to.have.attribute('data-focused', '');
        expect(control).to.have.attribute('data-focused', '');
        expect(label).to.have.attribute('data-focused', '');
        expect(description).to.have.attribute('data-focused', '');

        fireEvent.blur(control);

        expect(root).not.to.have.attribute('data-focused');
        expect(control).not.to.have.attribute('data-focused');
        expect(label).not.to.have.attribute('data-focused');
        expect(description).not.to.have.attribute('data-focused');
      });
    });
  });

  describe('defaultValue behavior', () => {
    it('should not reset to defaultValue when input value is programmatically changed and then focused', async () => {
      let inputRef: HTMLInputElement | undefined | null;

      render(() => (
        <Field.Root>
          <Field.Control
            ref={(el) => {
              inputRef = el;
            }}
            defaultValue="foo"
            data-testid="input"
          />
        </Field.Root>
      ));

      const input = screen.getByTestId('input') as HTMLInputElement;

      expect(input.value).to.equal('foo');

      if (inputRef) {
        inputRef.value = '';
      }

      expect(input.value).to.equal('');

      fireEvent.focus(input);

      expect(input.value).to.equal('');
    });

    it('should not reset to defaultValue when input value is programmatically changed to non-empty value and then focused', () => {
      let inputRef: HTMLInputElement | undefined | null;

      render(() => (
        <Field.Root>
          <Field.Control
            ref={(el) => {
              inputRef = el;
            }}
            defaultValue="foo"
            data-testid="input"
          />
        </Field.Root>
      ));

      const input = screen.getByTestId('input') as HTMLInputElement;

      expect(input.value).to.equal('foo');

      if (inputRef) {
        inputRef.value = 'abc';
      }

      expect(input.value).to.equal('abc');

      fireEvent.focus(input);

      expect(input.value).to.equal('abc');
    });
  });

  describe('prop: dirty', () => {
    it('controls the dirty state', () => {
      render(() => (
        <Field.Root data-testid="root" dirty>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      ['root', 'control', 'label', 'description'].forEach((part) => {
        expect(screen.getByTestId(part)).to.have.attribute('data-dirty');
      });
    });

    it('uses the controlled dirty state for required validation', async () => {
      render(() => (
        <Field.Root dirty validationMode="onBlur">
          <Field.Control data-testid="control" required />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const control = screen.getByTestId('control');

      fireEvent.focus(control);
      fireEvent.blur(control);

      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('error')).not.toBe(null);
    });

    it('does not update controlled dirty state from user input', async () => {
      render(() => (
        <Field.Root data-testid="root" dirty={false}>
          <Field.Control />
        </Field.Root>
      ));

      fireEvent.input(screen.getByRole('textbox'), { target: { value: 'changed' } });

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-dirty');
    });
  });

  describe('prop: touched', () => {
    it('controls the touched state', () => {
      render(() => (
        <Field.Root data-testid="root" touched>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      ['root', 'control', 'label', 'description'].forEach((part) => {
        expect(screen.getByTestId(part)).to.have.attribute('data-touched');
      });
    });

    it('does not update controlled touched state on blur', async () => {
      render(() => (
        <Field.Root data-testid="root" touched={false}>
          <Field.Control />
        </Field.Root>
      ));

      fireEvent.focus(screen.getByRole('textbox'));
      fireEvent.blur(screen.getByRole('textbox'));

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-touched');
    });
  });

  describe('prop: actionsRef', () => {
    it('validates the field when the `validate` method is called', async () => {
      function App() {
        const actionsRef = useRef<Field.Root.Actions>(null);
        return (
          <div>
            <Field.Root name="username" actionsRef={actionsRef}>
              <Field.Control defaultValue="" required />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="button" onClick={() => actionsRef.current?.validate()}>
              validate
            </button>
          </div>
        );
      }

      const { user } = render(() => <App />);

      expect(screen.queryByTestId('error')).to.equal(null);

      await user.click(screen.getByText('validate'));

      expect(screen.queryByTestId('error')).to.not.equal(null);
    });

    it('validates a logical field without a mounted control', async () => {
      function App() {
        const actionsRef = useRef<Field.Root.Actions | null>(null);
        return (
          <div>
            <Field.Root actionsRef={actionsRef} validate={() => 'Logical field error'}>
              <Field.Error />
            </Field.Root>
            <button type="button" onClick={() => actionsRef.current?.validate()}>
              validate
            </button>
          </div>
        );
      }

      const { user } = render(() => <App />);

      await user.click(screen.getByRole('button', { name: 'validate' }));

      expect(screen.getByText('Logical field error')).toBeVisible();
    });

    it('validates the current control value when the `validate` method is called', async () => {
      const validate = vi.fn((value) => (value === 'valid' ? null : 'error'));

      function App() {
        const actionsRef = useRef<Field.Root.Actions | null>(null);
        return (
          <div>
            <Field.Root actionsRef={actionsRef} validate={validate}>
              <Field.Control />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="button" onClick={() => actionsRef.current?.validate()}>
              validate
            </button>
          </div>
        );
      }

      const { user } = render(() => <App />);
      const control = screen.getByRole('textbox');

      fireEvent.input(control, { target: { value: 'valid' } });
      await user.click(screen.getByText('validate'));

      expect(validate.mock.lastCall?.[0]).toBe('valid');
      expect(screen.queryByTestId('error')).toBe(null);
    });
  });
});
