import { expect, vi, describe, it } from 'vitest';
import { Accordion } from '@solidports/base-ui/accordion';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

describe('<Accordion.Header />', () => {
  const { render } = createRenderer();

  it('throws when rendered outside an Accordion.Item', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Accordion.Header />)).toThrow(
        'Base UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  describeConformance(Accordion.Header, () => ({
    render: (node, props) =>
      render(() => (
        <Accordion.Root>
          <Accordion.Item>{node(props!)}</Accordion.Item>
        </Accordion.Root>
      )),
    refInstanceof: window.HTMLHeadingElement,
  }));
});
