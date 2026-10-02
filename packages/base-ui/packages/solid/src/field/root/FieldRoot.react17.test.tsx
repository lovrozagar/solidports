import { createRenderer } from '#test-utils';
import { Field } from '@solidports/base-ui/field';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createEffect, createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { useRef } from '../../solid-helpers';

// Solid: React 17 lacks `React.useId` and the owner-stack API, so the React suite mocks them away.
// Solid ids always come from the Solid runtime and there is no owner-stack API, so these
// behaviors run against the regular implementation.
describe('<Field.Root /> with the React 17 id fallback', () => {
  const { render } = createRenderer();

  it('falls back to a generated id when an explicit control id is removed', async () => {
    function TestCase() {
      const [explicit, setExplicit] = createSignal(true);

      return (
        <>
          <Field.Root>
            <Field.Label data-testid="label">Label</Field.Label>
            <Field.Control id={explicit() ? 'custom' : undefined} />
          </Field.Root>
          <button type="button" onClick={() => setExplicit(false)}>
            clear
          </button>
        </>
      );
    }

    render(() => <TestCase />);

    await waitFor(() => {
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'custom');
    });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByRole('textbox').id).not.toBe('custom');
    });

    const control = screen.getByRole('textbox');

    expect(control.id).not.toBe('');
    expect(screen.getByTestId('label')).toHaveAttribute('for', control.id);
  });

  it('allows mount-time imperative validation before the fallback id is assigned', async () => {
    function TestCase() {
      const actionsRef = useRef<Field.Root.Actions | null>(null);

      // Solid: effects run parent-first; a user effect runs after the field's render-phase
      // handle exists, as React's child-first layout effects order guarantees.
      createEffect(
        () => undefined,
        () => {
          actionsRef.current?.validate();
        },
      );

      return (
        <Field.Root actionsRef={actionsRef} validate={() => 'Mount-time error'}>
          <Field.Error />
        </Field.Root>
      );
    }

    render(() => <TestCase />);

    expect(await screen.findByText('Mount-time error')).toBeVisible();
  });

  it('reports label mismatches without the owner-stack API', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(() => (
        <Field.Root>
          <Field.Label render={(props) => <div {...props} />}>Label</Field.Label>
        </Field.Root>
      ));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('<Field.Label> expected a <label> element'),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('reports non-native label mismatches without the owner-stack API', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(() => (
        <Field.Root>
          <Field.Label nativeLabel={false}>Label</Field.Label>
        </Field.Root>
      ));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('<Field.Label> expected a non-<label> element'),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
