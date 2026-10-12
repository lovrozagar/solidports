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

  it('renders the disabled attribute when disabled', async () => {
    await render(() => (
      <Accordion.Root>
        <Accordion.Item disabled>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toBeDisabled();
    expect(trigger).not.toHaveAttribute('aria-disabled');
  });

  it('removes a disabled non-native trigger from the tab order', async () => {
    const { user } = await render(() => (
      <Accordion.Root>
        <Accordion.Item disabled>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} render="span">
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).toHaveAttribute('tabindex', '-1');
    expect(trigger).not.toHaveAttribute('disabled');

    await user.keyboard('[Tab]');
    expect(trigger).not.toHaveFocus();
  });

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
