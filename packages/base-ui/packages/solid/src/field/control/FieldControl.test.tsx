import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal, Show, untrack } from 'solid-js';
import { expect, vi } from 'vitest';
import { autofocus } from '../../solid-helpers';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from './FieldControl.ssr-fixtures';

// do not treeshake autofocus
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
autofocus;

describe('<Field.Control />', () => {
  const { render } = createRenderer();

  describeConformance(Field.Control, () => ({
    refInstanceof: window.HTMLInputElement,
    render: (node, props) => render(() => <Field.Root>{node(props!)}</Field.Root>),
  }));

  it('avoids rerendering for uncontrolled input changes', async () => {
    const renderCountRef = { current: 0 };

    function RenderCountedControl() {
      renderCountRef.current += 1;
      return <Field.Control data-testid="control" />;
    }

    render(() => (
      <Field.Root>
        <RenderCountedControl />
      </Field.Root>
    ));

    const control = screen.getByTestId('control');
    const initialRenderCount = renderCountRef.current;

    fireEvent.change(control, { target: { value: 'a' } });
    const afterFirstChange = renderCountRef.current;

    fireEvent.change(control, { target: { value: 'ab' } });
    fireEvent.change(control, { target: { value: 'abc' } });

    expect(renderCountRef.current).to.equal(afterFirstChange);
    expect(afterFirstChange).to.be.at.most(initialRenderCount + 1);
  });

  it('renders once per keystroke for controlled input changes', async () => {
    const renderCountRef = { current: 0 };

    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root>
          <Field.Control
            data-testid="control"
            value={value()}
            onValueChange={setValue}
            render={(props) => {
              renderCountRef.current += 1;
              return <input {...props} />;
            }}
          />
        </Field.Root>
      );
    }

    render(() => <App />);

    const control = screen.getByTestId('control');

    // The first keystroke also flips dirty and filled, so measure the steady state after it.
    fireEvent.input(control, { target: { value: 'a' } });
    const settledRenderCount = renderCountRef.current;

    fireEvent.input(control, { target: { value: 'ab' } });
    fireEvent.input(control, { target: { value: 'abc' } });

    // The controlled echo must not schedule a second render per keystroke.
    // Solid: the render function does not re-run per keystroke at all; prop changes reach the
    // element through its spread.
    expect(renderCountRef.current).to.be.at.most(settledRenderCount + 2);
  });

  it('validates once when changed by the user', async () => {
    const validate = vi.fn();

    render(() => (
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control />
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe('a');
  });

  it('validates once when a controlled value is changed by the user', async () => {
    const validate = vi.fn(() => null);

    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root validationMode="onChange" validate={validate}>
          <Field.Control value={value()} onValueChange={setValue} />
        </Field.Root>
      );
    }

    render(() => <App />);

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });

    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('clears dirty state when a numeric controlled value returns to its initial value', async () => {
    function App() {
      const [value, setValue] = createSignal(5);
      return (
        <Field.Root data-testid="root">
          <Field.Control
            value={value()}
            onValueChange={(nextValue) => setValue(Number(nextValue))}
          />
        </Field.Root>
      );
    }

    render(() => <App />);

    const root = screen.getByTestId('root');
    const control = screen.getByRole('textbox');

    expect(root).not.toHaveAttribute('data-dirty');

    fireEvent.input(control, { target: { value: '56' } });

    expect(root).toHaveAttribute('data-dirty', '');

    fireEvent.input(control, { target: { value: '5' } });

    expect(root).not.toHaveAttribute('data-dirty');
  });

  it('syncs state and validates when the controlled value changes programmatically', async () => {
    const validate = vi.fn((_value: unknown) => null);

    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
          <Field.Control value={value()} onValueChange={setValue} />
          <button type="button" onClick={() => setValue('external')}>
            set
          </button>
        </Field.Root>
      );
    }

    render(() => <App />);

    fireEvent.click(screen.getByRole('button'));

    const root = screen.getByTestId('root');

    expect(root).toHaveAttribute('data-filled', '');
    expect(root).toHaveAttribute('data-dirty', '');
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe('external');
  });

  it('validates the final controlled value when it is normalized on blur', async () => {
    const validate = vi.fn((value) => (String(value).includes('@') ? null : 'Invalid email'));

    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root validationMode="onBlur" validate={validate}>
          <Field.Control
            value={value()}
            onValueChange={setValue}
            onBlur={() => setValue((currentValue) => currentValue.trim())}
          />
          <Field.Error />
        </Field.Root>
      );
    }

    render(() => <App />);

    const control = screen.getByRole('textbox');
    fireEvent.input(control, { target: { value: 'foo ' } });
    fireEvent.blur(control);

    await flushMicrotasks();

    expect(validate.mock.lastCall?.[0]).toBe('foo');
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('keeps the final async validation when a controlled value is normalized on blur', async () => {
    const resolvers: Record<string, (value: string | null) => void> = {};
    const validate = vi.fn(
      (value) =>
        new Promise<string | null>((resolve) => {
          resolvers[String(value)] = resolve;
        }),
    );

    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root validationMode="onBlur" validate={validate}>
          <Field.Control
            value={value()}
            onValueChange={setValue}
            onBlur={() => setValue((currentValue) => currentValue.trim())}
          />
          <Field.Error />
        </Field.Root>
      );
    }

    render(() => <App />);

    const control = screen.getByRole('textbox');
    fireEvent.input(control, { target: { value: 'foo ' } });
    fireEvent.blur(control);

    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(2);
    expect(validate.mock.lastCall?.[0]).toBe('foo');

    resolvers.foo('Invalid email');
    await flushMicrotasks();

    expect(screen.getByText('Invalid email')).toBeInTheDocument();

    resolvers['foo ']('Stale error');
    await flushMicrotasks();

    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('does not validate when a controlled value is reset to the initial value on blur', async () => {
    function App() {
      const [value, setValue] = createSignal('');
      return (
        <Field.Root validationMode="onBlur">
          <Field.Control
            required
            value={value()}
            onValueChange={setValue}
            onBlur={() => setValue('')}
          />
          <Field.Error match="valueMissing">Required</Field.Error>
        </Field.Root>
      );
    }

    render(() => <App />);

    const control = screen.getByRole('textbox');
    fireEvent.input(control, { target: { value: 'foo' } });
    fireEvent.blur(control);

    await flushMicrotasks();

    expect(screen.queryByText('Required')).toBe(null);
  });

  it('sets filled state on mount when the control is prefilled', async () => {
    render(() => (
      <Field.Root data-testid="root">
        <Field.Control defaultValue="foo" />
      </Field.Root>
    ));

    expect(screen.getByTestId('root')).toHaveAttribute('data-filled', '');
  });

  it('does not set filled state on mount for an empty controlled value', async () => {
    render(() => (
      <Field.Root data-testid="root">
        <Field.Control value="" onValueChange={() => {}} />
      </Field.Root>
    ));

    expect(screen.getByTestId('root')).not.toHaveAttribute('data-filled');
  });

  it('clears filled state when a controlled control remounts empty', async () => {
    function App() {
      const [empty, setEmpty] = createSignal(false);
      return (
        <Field.Root data-testid="root">
          {/* Solid: a keyed `Show` remounts the control like React's `key`. */}
          <Show when={String(empty())} keyed>
            <Field.Control value={empty() ? '' : 'value'} onValueChange={() => {}} />
          </Show>
          <button type="button" onClick={() => setEmpty(true)}>
            clear
          </button>
        </Field.Root>
      );
    }

    render(() => <App />);

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-filled', '');

    fireEvent.click(screen.getByRole('button'));

    expect(root).not.toHaveAttribute('data-filled');
  });

  it('clears filled state when an uncontrolled control remounts empty', async () => {
    function App() {
      const [empty, setEmpty] = createSignal(false);
      return (
        <Field.Root data-testid="root">
          {/* Solid: a keyed `Show` remounts the control like React's `key`. */}
          <Show when={String(empty())} keyed>
            <Field.Control defaultValue={untrack(empty) ? '' : 'value'} />
          </Show>
          <button type="button" onClick={() => setEmpty(true)}>
            clear
          </button>
        </Field.Root>
      );
    }

    render(() => <App />);

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-filled', '');

    fireEvent.click(screen.getByRole('button'));

    expect(root).not.toHaveAttribute('data-filled');
  });

  it('sets filled state from a controlled value on a custom element', async () => {
    render(() => (
      <Field.Root data-testid="root">
        <Field.Control
          value="value"
          onValueChange={() => {}}
          render={(props) => <div {...props} />}
        />
      </Field.Root>
    ));

    expect(screen.getByTestId('root')).toHaveAttribute('data-filled', '');
  });

  it('does not validate when the change is canceled', async () => {
    const validate = vi.fn(() => null);

    render(() => (
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control onValueChange={(value, details) => details.cancel()} />
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });

    expect(validate).not.toHaveBeenCalled();
  });

  it('does not clear errors or validate when change is prevented', async () => {
    const validate = vi.fn();
    const handleValueChange = vi.fn();

    render(() => (
      <Form errors={{ message: 'Server error' }}>
        <Field.Root name="message" validationMode="onChange" validate={validate}>
          <Field.Control onValueChange={handleValueChange} />
          <Field.Error />
        </Field.Root>
      </Form>
    ));

    const control = screen.getByRole<HTMLInputElement>('textbox');
    control.addEventListener('input', (event) => event.preventDefault(), {
      capture: true,
      once: true,
    });
    fireEvent.input(control, { cancelable: true, target: { value: 'a' } });

    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(validate).not.toHaveBeenCalled();
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it.skipIf(isJSDOM)('validates once when Enter implicitly submits a form', async () => {
    const { userEvent } = await import('vitest/browser');
    const user = userEvent.setup();
    const validate = vi.fn(() => null);
    const handleSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

    render(() => (
      <Form onSubmit={handleSubmit}>
        <Field.Root validate={validate}>
          <Field.Control defaultValue="a" />
        </Field.Root>
        <button type="submit">submit</button>
      </Form>
    ));

    const control = screen.getByRole<HTMLInputElement>('textbox');

    await act(() => user.type(control, '[Enter]'));

    expect(validate).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it.skipIf(isJSDOM)('validates when Enter does not implicitly submit the form', async () => {
    const { userEvent } = await import('vitest/browser');
    const user = userEvent.setup();
    const validate = vi.fn(() => null);
    const handleSubmit = vi.fn();

    render(() => (
      <Form onSubmit={handleSubmit}>
        <Field.Root validate={validate}>
          <Field.Control defaultValue="a" />
        </Field.Root>
        <input />
      </Form>
    ));

    const control = screen.getByDisplayValue<HTMLInputElement>('a');

    await act(() => user.type(control, '[Enter]'));

    expect(validate).toHaveBeenCalledTimes(1);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it.skipIf(isJSDOM)(
    'validates when a disabled submit button blocks implicit submission',
    async () => {
      const { userEvent } = await import('vitest/browser');
      const user = userEvent.setup();
      const validate = vi.fn(() => null);
      const handleSubmit = vi.fn();

      render(() => (
        <Form onSubmit={handleSubmit}>
          <Field.Root validate={validate}>
            <Field.Control defaultValue="a" />
          </Field.Root>
          <button type="submit" disabled>
            submit
          </button>
        </Form>
      ));

      const control = screen.getByRole<HTMLInputElement>('textbox');

      await act(() => user.type(control, '[Enter]'));

      expect(validate).toHaveBeenCalledTimes(1);
      expect(handleSubmit).not.toHaveBeenCalled();
    },
  );

  it('validates the latest value when Enter does not submit the form', async () => {
    const validate = vi.fn((_value: unknown) => null);

    function App() {
      const [value, setValue] = createSignal('a');
      return (
        <Form onKeyDown={() => setValue('')}>
          <Field.Root validate={validate}>
            <Field.Control value={value()} onValueChange={setValue} />
          </Field.Root>
          <input />
        </Form>
      );
    }

    render(() => <App />);

    const control = screen.getByDisplayValue<HTMLInputElement>('a');
    act(() => control.focus());
    fireEvent.keyDown(control, { key: 'Enter' });

    await waitFor(() => {
      expect(validate).toHaveBeenCalledTimes(1);
    });

    expect(validate.mock.lastCall?.[0]).toBe('');
  });

  it('validates when Enter is pressed outside a form', async () => {
    const validate = vi.fn(() => null);

    render(() => (
      <Field.Root validate={validate}>
        <Field.Control defaultValue="a" />
      </Field.Root>
    ));

    const control = screen.getByRole('textbox');
    act(() => control.focus());
    fireEvent.keyDown(control, { key: 'Enter' });

    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('shows a required error when a prefilled value is cleared', async () => {
    render(() => (
      <Field.Root validationMode="onChange">
        <Field.Control data-testid="control" defaultValue="value" required />
        <Field.Error match="valueMissing">Required</Field.Error>
      </Field.Root>
    ));

    const control = screen.getByTestId('control');

    fireEvent.input(control, { target: { value: '' } });

    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it.skipIf(isJSDOM)('should sync focused state when autoFocus is used with SSR', async () => {
    vi.spyOn(console, 'error')
      .mockName('console.error')
      .mockImplementation(() => {});

    const { hydrate } = renderServer(fixtures, 'autoFocus');

    const control = screen.getByRole('textbox');
    expect(control).to.have.attribute('autofocus');

    // Simulate focused by browser before hydration
    control.focus();
    expect(control).to.equal(document.activeElement);

    hydrate();

    expect(screen.getByTestId('root')).to.have.attribute('data-focused', '');
    expect(control).to.have.attribute('data-focused', '');
    expect(screen.getByText('Name')).to.have.attribute('data-focused', '');
  });

  describe('id', () => {
    it('updates the label association when the control is swapped', async () => {
      function App() {
        const [controlKey, setControlKey] = createSignal('a');
        return (
          <>
            <Field.Root>
              <Field.Label data-testid="label">Label</Field.Label>
              {/* Solid: a keyed `Show` remounts the control like React's `key`. */}
              <Show when={controlKey()} keyed>
                {(key) => <Field.Control id={key} />}
              </Show>
            </Field.Root>
            <button onClick={() => setControlKey('b')}>swap</button>
          </>
        );
      }

      render(() => <App />);

      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'a');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'b');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'b');
    });
  });
});
