import { act, createRenderer, describeConformance } from '#test-utils';
import { Field } from '@solidports/base-ui/field';
import { screen } from '@solidjs/testing-library';
import { createSignal, Show } from 'solid-js';
import { expect } from 'vitest';

describe('<Field.Label />', () => {
  const { render } = createRenderer();

  describeConformance(Field.Label, () => ({
    refInstanceof: window.HTMLLabelElement,
    render: (node, props) => render(() => <Field.Root>{node(props!)}</Field.Root>),
    testRenderPropWith: 'label',
  }));

  it('should set htmlFor referencing the control automatically', () => {
    render(() => (
      <Field.Root data-testid="field">
        <Field.Control />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    expect(screen.getByTestId('label')).to.have.attribute('for', screen.getByRole('textbox').id);
  });

  it('when nativeLabel={false}, clicking focuses the associated control', async () => {
    const { user } = render(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
        <Field.Label nativeLabel={false} render="div" data-testid="label">
          Label
        </Field.Label>
      </Field.Root>
    ));

    const label = screen.getByTestId('label');
    const control = screen.getByTestId('control');

    expect(label).to.not.have.attribute('for');

    await user.click(label);
    expect(control).toHaveFocus();
  });

  describe('control selection', () => {
    // Solid: a signal drives the controls instead of React's `rerender`.
    function renderFields() {
      const [first, setFirst] = createSignal(true);
      const [second, setSecond] = createSignal(true);
      render(() => (
        <Field.Root>
          <Show when={first()}>
            <Field.Control id="a" />
          </Show>
          <Show when={second()}>
            <Field.Control id="b" />
          </Show>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Root>
      ));
      return { setFirst, setSecond };
    }

    it('keeps the selected control id when another control unmounts', async () => {
      const { setSecond } = renderFields();

      expect(screen.getByTestId('label')).to.have.attribute('for', 'a');

      await act(() => setSecond(false));

      expect(screen.getByTestId('label')).to.have.attribute('for', 'a');
    });

    it('falls over to the remaining control when the selected one unmounts', async () => {
      const { setFirst } = renderFields();

      expect(screen.getByTestId('label')).to.have.attribute('for', 'a');

      await act(() => setFirst(false));

      expect(screen.getByTestId('label')).to.have.attribute('for', 'b');
    });
  });

  it('reflects the disabled state from Field.Item', () => {
    render(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Item>
      </Field.Root>
    ));

    expect(screen.getByTestId('label')).to.have.attribute('data-disabled');
  });

  describe('dev warnings', () => {
    it('does not warn by default', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      render(() => (
        <Field.Root>
          <Field.Control />
          <Field.Label>Label</Field.Label>
        </Field.Root>
      ));

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('does not warn when the render function returns no element', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      function EmptyLabel() {
        return null;
      }

      render(() => (
        <Field.Root>
          <Field.Label render={() => <EmptyLabel />}>Label</Field.Label>
        </Field.Root>
      ));

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('errors if nativeLabel=true but ref is not a label', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      render(() => (
        <Field.Root>
          <Field.Control />
          <Field.Label nativeLabel render="div">
            Label
          </Field.Label>
        </Field.Root>
      ));

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Base UI: <Field.Label> expected a <label> element because the `nativeLabel` prop is true. ' +
            'Rendering a non-<label> disables native label association, so `htmlFor` will not ' +
            'work. Use a real <label> in the `render` prop, or set `nativeLabel` to `false`.',
        ),
      );
      errorSpy.mockRestore();
    });

    it('errors if nativeLabel=false but ref is a label', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      render(() => (
        <Field.Root>
          <Field.Control />
          <Field.Label nativeLabel={false}>Label</Field.Label>
        </Field.Root>
      ));

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Base UI: <Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. ' +
            'Rendering a <label> assumes native label behavior while Base UI treats it as ' +
            'non-native, which can cause unexpected pointer behavior. Use a non-<label> in the ' +
            '`render` prop, or set `nativeLabel` to `true`.',
        ),
      );
      errorSpy.mockRestore();
    });
  });
});
