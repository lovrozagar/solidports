import { expect, describe, it } from 'vitest';
import { Accordion } from '@solidports/base-ui/accordion';
import { screen } from '@solidjs/testing-library';
import { describeConformance, createRenderer } from '#test-utils';

describe('<Accordion.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(Accordion.Trigger, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render: (node, props) =>
      render(() => (
        <Accordion.Root>
          <Accordion.Item>{node(props!)}</Accordion.Item>
        </Accordion.Root>
      )),
  }));

  it('keeps a non-native trigger tabbable', async () => {
    await render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} render="span">
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('tabindex', '0');
  });
});
