import { expect, vi, describe, it } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

describe('<Collapsible.Trigger />', () => {
  const { render } = createRenderer();

  it('throws when rendered outside a Collapsible.Root', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Collapsible.Trigger />)).toThrow(
        'Base UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  describeConformance(Collapsible.Trigger, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render: (node, props) => render(() => <Collapsible.Root>{node(props!)}</Collapsible.Root>),
  }));

  it('forwards the id prop', async () => {
    await render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger id="custom-trigger-id">Trigger</Collapsible.Trigger>
      </Collapsible.Root>
    ));

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'id',
      'custom-trigger-id',
    );
  });
});
