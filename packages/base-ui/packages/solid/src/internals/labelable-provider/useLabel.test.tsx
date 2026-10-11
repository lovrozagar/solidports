import { Show } from 'solid-js';
import { Portal } from '@solidjs/web';
import { screen, within } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { Field } from '@solidports/base-ui/field';
import { act, createRenderer } from '#test-utils';
import { useLabel } from './useLabel';

describe('useLabel', () => {
  const { render } = createRenderer();

  function TestControl() {
    return (
      <Field.Root name="country">
        <Combobox.Root>
          <Combobox.Label>Country</Combobox.Label>
          <Combobox.Trigger id="country">Choose a country</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input aria-label="Search countries" />
                <Combobox.List>
                  <Combobox.Item value="fr">France</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>
    );
  }

  function mountShadow() {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);
    document.body.appendChild(host);
    return { host, shadowRoot, container };
  }

  it.each([false, true])(
    'focuses the trigger in its shadow root without opening the popup (outer matching ID: %s)',
    async (outerMatchingId) => {
      const { host, shadowRoot, container } = mountShadow();

      try {
        const { user } = render(() => (
          <>
            <Show when={outerMatchingId}>
              <input id="country" aria-label="Unrelated control" />
            </Show>
            <Portal mount={container}>
              <TestControl />
            </Portal>
          </>
        ));

        const trigger = within(container).getByRole('combobox', { name: 'Country' });
        await user.click(within(container).getByText('Country'));

        expect(shadowRoot.activeElement).toBe(trigger);
        expect(document.activeElement).toBe(host);
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      } finally {
        host.remove();
      }
    },
  );

  it('preserves native label activation inside a shadow root', async () => {
    const { host, shadowRoot, container } = mountShadow();

    try {
      const { user } = render(
        () => (
          <Field.Root>
            <Field.Label>Name</Field.Label>
            <Field.Control />
          </Field.Root>
        ),
        {},
        { container },
      );

      const control = within(container).getByRole('textbox', { name: 'Name' });
      await user.click(within(container).getByText('Name'));

      expect(shadowRoot.activeElement).toBe(control);
    } finally {
      host.remove();
    }
  });

  it('focuses a control in the light DOM from a label in a shadow root', async () => {
    const { host, container } = mountShadow();

    try {
      const { user } = render(() => (
        <Combobox.Root>
          <Portal mount={container}>
            <Combobox.Label>Country</Combobox.Label>
          </Portal>
          <Combobox.Trigger id="country">Choose a country</Combobox.Trigger>
        </Combobox.Root>
      ));

      await user.click(within(container).getByText('Country'));

      expect(screen.getByRole('combobox')).toHaveFocus();
    } finally {
      host.remove();
    }
  });

  it('focuses a control in an ancestor shadow root from a label in a nested shadow root', async () => {
    const outerHost = document.createElement('div');
    const outerShadowRoot = outerHost.attachShadow({ mode: 'open' });
    const outerContainer = document.createElement('div');
    const innerHost = document.createElement('div');
    const innerContainer = document.createElement('div');
    innerHost.attachShadow({ mode: 'open' }).appendChild(innerContainer);
    outerShadowRoot.append(outerContainer, innerHost);
    document.body.appendChild(outerHost);

    try {
      const { user } = render(() => (
        <Combobox.Root>
          <Portal mount={innerContainer}>
            <Combobox.Label>Country</Combobox.Label>
          </Portal>
          <Portal mount={outerContainer}>
            <Combobox.Trigger id="country">Choose a country</Combobox.Trigger>
          </Portal>
        </Combobox.Root>
      ));

      await user.click(within(innerContainer).getByText('Country'));

      expect(outerShadowRoot.activeElement).toBe(within(outerContainer).getByRole('combobox'));
    } finally {
      outerHost.remove();
    }
  });

  it('does not focus the control when a composed click originates inside a nested button', async () => {
    function Test() {
      const labelProps = useLabel({ fallbackControlId: 'control' });
      const hostRef = (host: HTMLSpanElement | null) => {
        if (host && !host.shadowRoot) {
          const target = document.createElement('span');
          target.dataset.testid = 'shadow-target';
          host.attachShadow({ mode: 'open' }).appendChild(target);
        }
      };

      return (
        <>
          <div {...labelProps}>
            Label
            <button type="button">
              Action
              <span ref={hostRef} />
            </button>
          </div>
          <input id="control" />
        </>
      );
    }

    render(() => <Test />);

    const button = screen.getByRole('button');
    const target = button.querySelector('span')?.shadowRoot?.querySelector('span');
    const control = screen.getByRole('textbox');

    expect(target).not.toBeNull();

    await act(async () => {
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    });

    expect(control).not.toHaveFocus();
  });
});
