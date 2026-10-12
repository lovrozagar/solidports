import { screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { expect, vi, describe, it } from 'vitest';
import { Menu } from '@solidports/base-ui/menu';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

describe('Menu filter parts conformance', () => {
  const { render } = createRenderer();

  function renderInPopup(
    node: () => JSX.Element,
    filterProps?: Partial<Menu.FilterProvider.Props>,
    withInput = true,
  ) {
    return render(() => (
      <Menu.FilterProvider {...filterProps}>
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                {withInput && <Menu.Input aria-label="Filter" />}
                {node()}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));
  }

  function renderInList(node: () => JSX.Element) {
    return renderInPopup(() => <Menu.List>{node()}</Menu.List>);
  }

  describeConformance(Menu.Trigger, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render: (node, props) =>
      render(() => (
        <Menu.FilterProvider>
          <Menu.Root>{node(props!)}</Menu.Root>
        </Menu.FilterProvider>
      )),
  }));

  describeConformance(Menu.Input, () => ({
    refInstanceof: window.HTMLInputElement,
    render: (node, props) => renderInPopup(() => node(props!), undefined, false),
  }));

  describeConformance(Menu.Clear, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render: (node, props) => renderInPopup(() => node(props!), { defaultValue: 'query' }),
  }));

  it('excludes Clear from the tab order and accessibility tree', async () => {
    renderInPopup(() => <Menu.Clear aria-label="Clear filter" />, { defaultValue: 'query' });

    const clear = screen.getByLabelText('Clear filter');
    expect(clear).toHaveAttribute('tabindex', '-1');
    expect(clear).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: 'Clear filter' })).toBe(null);
  });

  describeConformance(Menu.Empty, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => renderInPopup(() => node(props!)),
  }));

  describeConformance(Menu.List, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => renderInPopup(() => node(props!)),
  }));

  describeConformance(
    (props: Menu.Popup.Props) => (
      <Menu.Popup {...props}>
        <Menu.Input aria-label="Filter" />
      </Menu.Popup>
    ),
    () => ({
      refInstanceof: window.HTMLDivElement,
      render: (node, props) =>
        render(() => (
          <Menu.FilterProvider>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>{node(props!)}</Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        )),
    }),
  );

  describeConformance(Menu.Item, () => ({
    refInstanceof: window.HTMLDivElement,
    button: true,
    render: (node, props) => renderInList(() => node(props!)),
  }));

  describeConformance(
    (props: Menu.LinkItem.Props) => <Menu.LinkItem href="#" {...props} />,
    () => ({
      refInstanceof: window.HTMLAnchorElement,
      render: (node, props) => renderInList(() => node(props!)),
    }),
  );

  describeConformance(Menu.CheckboxItem, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => renderInList(() => node(props!)),
  }));

  describeConformance(
    (props: Menu.RadioGroup.Props) => (
      <Menu.RadioGroup {...props}>
        <Menu.RadioItem value="value" />
      </Menu.RadioGroup>
    ),
    () => ({
      refInstanceof: window.HTMLDivElement,
      render: (node, props) => renderInList(() => node(props!)),
    }),
  );

  describeConformance(
    (props: Menu.RadioItem.Props) => <Menu.RadioItem value="value" {...props} />,
    () => ({
      refInstanceof: window.HTMLDivElement,
      render: (node, props) =>
        renderInList(() => <Menu.RadioGroup defaultValue="value">{node(props!)}</Menu.RadioGroup>),
    }),
  );

  describeConformance(Menu.Group, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => renderInList(() => node(props!)),
  }));

  describeConformance(Menu.Arrow, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => renderInPopup(() => node(props!)),
  }));

  describeConformance(Menu.Backdrop, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => (
        <Menu.FilterProvider>
          <Menu.Root open>
            <Menu.Portal>
              {node(props!)}
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter" />
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      )),
  }));

  describeConformance(Menu.Separator, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => renderInList(() => node(props!)),
  }));

  describeConformance(Menu.SubmenuTrigger, () => ({
    refInstanceof: window.HTMLDivElement,
    button: true,
    render: (node, props) =>
      renderInList(() => (
        <Menu.FilterProvider>
          <Menu.SubmenuRoot>{node(props!)}</Menu.SubmenuRoot>
        </Menu.FilterProvider>
      )),
  }));

  it('throws when Trigger is rendered without a root or handle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Menu.Trigger />)).toThrow(
        'Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it.each([
    ['Input', () => <Menu.Input />],
    ['Clear', () => <Menu.Clear />],
    ['Empty', () => <Menu.Empty />],
  ] as const)(
    'throws when <Menu.%s> is rendered without a filter provider',
    async (part, element) => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        expect(() => render(element)).toThrow(
          `Base UI: <Menu.${part}> must be placed in a menu wrapped in <Menu.FilterProvider>.`,
        );
        await flushMicrotasks();
      } finally {
        errorSpy.mockRestore();
      }
    },
  );
});
