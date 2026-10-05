import { act, createRenderer } from '#test-utils';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';
import { screen, waitFor } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { createSignal, Show } from 'solid-js';

// Solid: ids always come from the Solid runtime, so there is no React 17 `useId` fallback to mock;
// these cases run against the regular id path.
describe('<Checkbox.Root /> with the React 17 id fallback', () => {
  const { render } = createRenderer();

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

      act(() => setCheckboxId(undefined));

      const control = getLabelControl(nativeButton);
      expect(control.id).not.to.equal('');
      expect(control).not.to.have.attribute('id', 'explicit');
      expect(screen.getByTestId('label')).to.have.attribute('for', control.id);
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

      act(() => setProps({ checkboxKey: 'generated' }));

      const control = getLabelControl(nativeButton);
      expect(control.id).not.to.equal('');
      expect(control).not.to.have.attribute('id', 'explicit');
      expect(screen.getByTestId('label')).to.have.attribute('for', control.id);
    },
  );

  // Solid: asserts the server markup has no ids because React 17 has no `useId` and assigns ids only
  // on the client; Solid generates ids during the server render, so that markup cannot exist (the
  // hydrated label association is covered by CheckboxGroup's "during SSR" tests).
  it.skip.each([false, true])(
    'assigns the label association once the fallback ids arrive (nativeButton=%s)',
    () => {},
  );

  it.each([false, true])(
    'wires parent aria-controls once the fallback ids are assigned (nativeButton=%s)',
    async (nativeButton) => {
      render(() => (
        <Field.Root name="apple">
          <CheckboxGroup allValues={['fuji', 'gala']}>
            <Checkbox.Root
              parent
              data-testid="parent"
              nativeButton={nativeButton}
              render={nativeButton ? 'button' : undefined}
            />
            <Checkbox.Root
              value="fuji"
              data-testid="fuji"
              nativeButton={nativeButton}
              render={nativeButton ? 'button' : undefined}
            />
            <Checkbox.Root
              value="gala"
              data-testid="gala"
              nativeButton={nativeButton}
              render={nativeButton ? 'button' : undefined}
            />
          </CheckboxGroup>
        </Field.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('parent')).to.have.attribute(
          'aria-controls',
          `${screen.getByTestId('fuji').id} ${screen.getByTestId('gala').id}`,
        );
      });
    },
  );
});
