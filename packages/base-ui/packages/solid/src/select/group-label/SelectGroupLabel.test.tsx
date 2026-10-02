import { createSignal, Show } from 'solid-js';
import { expect, vi, describe, it } from 'vitest';
import { Select } from '@solidports/base-ui/select';
import { act, createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { screen } from '@solidjs/testing-library';

describe('<Select.GroupLabel />', () => {
  const { render } = createRenderer();

  describeConformance(Select.GroupLabel, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Select.Root open>
          <Select.Group>{node(props!)}</Select.Group>
        </Select.Root>
      ));
    },
  }));

  it('is hidden from the accessibility tree by default', async () => {
    render(() => (
      <Select.Root open>
        <Select.Group>
          <Select.GroupLabel>Fruits</Select.GroupLabel>
        </Select.Group>
      </Select.Root>
    ));

    expect(screen.getByText('Fruits')).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding aria-hidden', async () => {
    render(() => (
      <Select.Root open>
        <Select.Group>
          <Select.GroupLabel aria-hidden={undefined}>Fruits</Select.GroupLabel>
        </Select.Group>
      </Select.Root>
    ));

    expect(screen.getByText('Fruits')).not.toHaveAttribute('aria-hidden');
  });

  it('throws a descriptive error when rendered outside <Select.Group>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows an uncaught render error with a console footer.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Solid: the uncaught render error also reaches `reportError` where the platform has one.
    const reportErrorSpy =
      typeof globalThis.reportError === 'function'
        ? vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
        : undefined;

    try {
      // Solid: rendering is synchronous, so the error is thrown rather than rejected.
      expect(() =>
        render(() => (
          <Select.Root open>
            <Select.GroupLabel />
          </Select.Root>
        )),
      ).toThrow(
        'Base UI: SelectGroupContext is missing. SelectGroup parts must be placed within <Select.Group>.',
      );
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      reportErrorSpy?.mockRestore();
    }
  });

  it('removes the group aria-labelledby attribute when unmounted', async () => {
    const [labelMounted, setLabelMounted] = createSignal(true);

    render(() => (
      <Select.Root open>
        <Select.Group>
          <Show when={labelMounted()}>
            <Select.GroupLabel id="group-label">Fruits</Select.GroupLabel>
          </Show>
        </Select.Group>
      </Select.Root>
    ));

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-labelledby', 'group-label');

    act(() => setLabelMounted(false));

    expect(screen.queryByText('Fruits')).toBe(null);
    expect(group).not.toHaveAttribute('aria-labelledby');
  });

  it('does not let an older label cleanup clear a newer label', async () => {
    const [labels, setLabels] = createSignal<'old' | 'both' | 'new'>('old');

    render(() => (
      <Select.Root open>
        <Select.Group>
          <Show when={labels() !== 'new'}>
            <Select.GroupLabel id="old-label">Old</Select.GroupLabel>
          </Show>
          <Show when={labels() !== 'old'}>
            <Select.GroupLabel id="new-label">New</Select.GroupLabel>
          </Show>
        </Select.Group>
      </Select.Root>
    ));

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-labelledby', 'old-label');

    act(() => setLabels('both'));
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');

    act(() => setLabels('new'));
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');
  });
  it('updates explicit and generated ids independently of ref churn', async () => {
    const firstRef = vi.fn();
    const secondRef = vi.fn();
    const [labelProps, setLabelProps] = createSignal<{
      id?: string | undefined;
      labelRef: (element: HTMLDivElement | null) => void;
    }>({ labelRef: firstRef });

    render(() => (
      <Select.Root open>
        <Select.Group>
          <Select.GroupLabel id={labelProps().id} ref={labelProps().labelRef}>
            Fruits
          </Select.GroupLabel>
        </Select.Group>
      </Select.Root>
    ));

    const group = screen.getByRole('group');
    const label = screen.getByText('Fruits');
    const generatedId = label.id;
    expect(group).toHaveAttribute('aria-labelledby', generatedId);

    act(() => setLabelProps({ id: 'custom-label', labelRef: secondRef }));
    expect(group).toHaveAttribute('aria-labelledby', 'custom-label');
    // Solid: user refs are applied once per element and never called with `null`, so ref churn does
    // not re-invoke them; the ids must still update independently of it.
    expect(firstRef).toHaveBeenCalledWith(label);

    act(() => setLabelProps({ labelRef: secondRef }));
    expect(group).toHaveAttribute('aria-labelledby', generatedId);
  });

  // Solid: there is no Strict Mode double render; the label replacement and removal still run.
  it('replaces and unregisters its label in Strict Mode', async () => {
    const [labelId, setLabelId] = createSignal<string | undefined>('first-label');

    render(() => (
      <Select.Root open>
        <Select.Group>
          <Show when={labelId()} keyed>
            {(id) => <Select.GroupLabel id={id}>{id}</Select.GroupLabel>}
          </Show>
        </Select.Group>
      </Select.Root>
    ));

    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-labelledby', 'first-label');

    act(() => setLabelId('second-label'));
    expect(group).toHaveAttribute('aria-labelledby', 'second-label');

    act(() => setLabelId(undefined));
    expect(group).not.toHaveAttribute('aria-labelledby');
  });
});
