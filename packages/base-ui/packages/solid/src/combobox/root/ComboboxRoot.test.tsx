import { expect, vi, describe, beforeEach, it } from 'vitest';
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onSettled,
  Show,
} from 'solid-js';
import { spy } from 'sinon';
import { useRef } from '@solidports/base-ui/solid-helpers';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Portal } from '@solidjs/web';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { act, createRenderer, flushMicrotasks, isJSDOM, popupConformanceTests } from '#test-utils';
import { Combobox } from '@solidports/base-ui/combobox';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { DirectionProvider } from '@solidports/base-ui/direction-provider';
import { Dialog } from '@solidports/base-ui/dialog';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { Input } from '@solidports/base-ui/input';
import { Popover } from '@solidports/base-ui/popover';
import { useTimeout } from '../../utils/useTimeout';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { REASONS } from '../../utils/reasons';
import { useComboboxRootContext } from './ComboboxRootContext';

function AsyncItemsCombobox() {
  const [items, setItems] = createSignal(['Apple', 'Banana', 'Cherry']);
  const [selectedValue, setSelectedValue] = createSignal<string | null>(null);

  return (
    <Combobox.Root
      items={items()}
      onValueChange={(value: string | null) => {
        setSelectedValue(value);
      }}
      onOpenChangeComplete={(open) => {
        const value = selectedValue();
        if (!open && value) {
          setItems([value]);
        }
      }}
    >
      <Combobox.Input data-testid="input" />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function SelectedIndexProbe() {
  const store = useComboboxRootContext();
  const selectedIndex = store.useState('selectedIndex');

  return (
    <div data-testid="selected-index">
      {selectedIndex() === null ? 'null' : `${selectedIndex()}`}
    </div>
  );
}

function getHiddenControl() {
  return screen
    .getAllByRole<HTMLInputElement>('textbox', { hidden: true })
    .find((element) => element.getAttribute('aria-hidden') === 'true')!;
}

function ActiveIndexProbe() {
  const store = useComboboxRootContext();
  const activeIndex = store.useState('activeIndex');

  return (
    <div data-testid="active-index">{activeIndex() === null ? 'null' : `${activeIndex()}`}</div>
  );
}

function ClearActiveIndexButton() {
  const store = useComboboxRootContext();

  return (
    <button type="button" onClick={() => store.context.setIndices({ activeIndex: null })}>
      Clear highlight
    </button>
  );
}

function MultiplePopupCombobox(props: {
  items?: readonly string[];
  defaultValue?: string[];
  onItemHighlighted?: Combobox.Root.Props<string, true>['onItemHighlighted'];
}) {
  return (
    <Combobox.Root
      items={props.items ?? ['apple', 'banana', 'cherry']}
      multiple
      defaultValue={props.defaultValue ?? ['apple', 'banana']}
      onItemHighlighted={props.onItemHighlighted}
    >
      <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
      <ActiveIndexProbe />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.Input data-testid="input" />
            <Combobox.List>
              {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function isElementOrAncestorInert(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.getAttribute('aria-hidden') === 'true' ||
      current.hasAttribute('inert') ||
      current.hasAttribute('data-base-ui-inert')
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

describe('<Combobox.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <Combobox.Root {...props.root}>
        <Combobox.Input data-testid="trigger" />
        <Combobox.Portal {...props.portal}>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List {...props.popup}>
                <Combobox.Item value="item">Item</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'listbox',
    combobox: true,
  });

  // Solid: the test harness has no renderToString/hydrate renderer, so these assert the client render.
  describe('server-side rendering', () => {
    it('sets combobox aria attributes on the input', () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('sets combobox aria attributes on the trigger when input is inside popup', () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('role', 'combobox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    });

    // Solid: asserts the pre-hydration server markup, which needs a renderToString renderer.
    it.skip('does not link Combobox.Label to trigger before hydration', () => {
      render(() => (
        <Combobox.Root inline>
          <Combobox.Label data-testid="label">Food</Combobox.Label>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>
      ));

      const label = screen.getByTestId('label');
      const trigger = screen.getByTestId('trigger');

      expect(label.id).not.toBe('');
      expect(trigger.id).not.toBe('');
      expect(trigger).not.toHaveAttribute('aria-labelledby');
    });
  });

  it('does not focus input when closing via trigger click (input inside popup)', async () => {
    const { user } = render(() => (
      <Combobox.Root items={['One', 'Two', 'Three']}>
        <Combobox.Trigger data-testid="trigger">
          <Combobox.Value />
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup aria-label="Demo">
              <Combobox.Input data-testid="input" aria-label="combobox-input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);

    expect(await screen.findByRole('listbox')).not.to.equal(null);

    const input = await screen.findByRole('combobox', { name: 'combobox-input' });
    await waitFor(() => expect(input).toHaveFocus());

    await user.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  describe('input inside popup composition', () => {
    it('selects with the keyboard, restores focus, and resets the query on reopen', async () => {
      const items = ['Apple', 'Banana', 'Cherry'];
      const { user } = render(() => (
        <Combobox.Root items={items}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select a fruit" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Fruits">
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ban');
      await user.keyboard('{ArrowDown}{Enter}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveTextContent('Banana');

      await user.click(trigger);

      const reopenedInput = await screen.findByTestId('input');
      expect(reopenedInput).toHaveValue('');

      const banana = await screen.findByRole('option', { name: 'Banana' });
      expect(banana).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
    });

    it('discards an uncommitted query on Escape and preserves the selection', async () => {
      const onValueChange = vi.fn();
      const { user } = render(() => (
        <Combobox.Root
          items={['Apple', 'Banana', 'Cherry']}
          defaultValue="Apple"
          onValueChange={onValueChange}
        >
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Fruits">
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);
      await user.type(await screen.findByTestId('input'), 'ban');
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveTextContent('Apple');
      expect(onValueChange).not.toHaveBeenCalled();

      await user.click(trigger);

      expect(await screen.findByTestId('input')).toHaveValue('');
      expect(await screen.findByRole('option', { name: 'Apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(await screen.findByRole('option', { name: 'Banana' })).not.toBe(null);
    });

    it('keeps filtering responsive when the selection close is canceled', async () => {
      const { user } = render(() => (
        <Combobox.Root
          items={['Apple', 'Apricot', 'Banana']}
          onOpenChange={(open, eventDetails) => {
            if (!open) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select a fruit" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Fruits">
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      const input = await screen.findByTestId('input');
      await user.type(input, 'ap');
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(screen.getByTestId('trigger')).toHaveTextContent('Apple');

      await user.clear(input);
      await user.type(input, 'ba');

      expect(await screen.findByRole('option', { name: 'Banana' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'Apple' })).toBe(null);
    });

    it.skipIf(isJSDOM)(
      'clears a single-select query and restores the selection when reopening during the close animation',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 100ms linear;
          }
        `;

        const { user } = render(() => (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={style} />
            <Combobox.Root items={['Apple', 'Banana']} defaultValue="Banana">
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <SelectedIndexProbe />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        ));

        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);
        const input = await screen.findByTestId('input');
        await user.clear(input);
        await user.type(input, 'banana');
        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

        await user.click(trigger);

        await waitFor(() => expect(popup).not.toHaveAttribute('data-ending-style'));
        expect(screen.getByTestId('selected-index')).toHaveTextContent('1');
        expect(input).toHaveValue('');
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        const bananaItem = screen.getByRole('option', { name: 'Banana' });
        await waitFor(() => expect(bananaItem).toHaveAttribute('data-highlighted'));
        await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', bananaItem.id));
      },
    );

    it.skipIf(isJSDOM)(
      'preserves a typed query when input reopens single-select during the close animation',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 100ms linear;
          }
        `;

        const { user } = render(() => (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={style} />
            <Combobox.Root items={['Apple', 'Banana']}>
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'ap');
        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

        input.focus();
        await user.type(input, 'b', { skipClick: true });

        await waitFor(() => expect(popup).not.toHaveAttribute('data-ending-style'));
        expect(input).toHaveValue('apb');
        expect(screen.getByRole('status')).toHaveTextContent('No matches');
        expect(screen.queryByRole('option')).toBe(null);
      },
    );
  });

  it('does not aria-hide the input group when the input is outside the popup', async () => {
    const { user } = render(() => (
      <Combobox.Root items={['apple', 'banana']}>
        <Combobox.InputGroup data-testid="group">
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByTestId('input');
    const group = screen.getByTestId('group');

    await user.click(input);
    expect(await screen.findByRole('listbox')).not.toBe(null);
    await flushMicrotasks();

    expect(input).toHaveFocus();
    expect(group).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('dismisses the popup when clicking a plain wrapper around the input', async () => {
    const { user } = render(() => (
      <Combobox.Root items={['apple', 'banana']}>
        <div style={{ padding: '10px' }}>
          <span data-testid="pad">padding</span>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('listbox')).not.toBe(null);

    await user.click(screen.getByTestId('pad'));

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  // Solid: native capture listeners on the popup do not see events from portalled content (no React-tree propagation).
  it.skip('does not dismiss when pressing portalled content inside the popup but outside the list', async () => {
    const { user } = render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
              <Portal mount={document.body}>
                <div>Portalled content</div>
              </Portal>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByText('Portalled content'));

    expect(screen.getByRole('listbox')).not.toBe(null);
  });

  it('does not navigate the list with arrow keys from portalled controls inside the popup', async () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <ActiveIndexProbe />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
              <Portal mount={document.body}>
                <button type="button">Portalled control</button>
              </Portal>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const portalledControl = screen.getByRole('button', { name: 'Portalled control' });
    portalledControl.focus();
    fireEvent.keyDown(portalledControl, { key: 'ArrowDown' });

    expect(screen.getByTestId('active-index')).toHaveTextContent('null');
  });

  // Solid: native capture listeners on the popup do not see events from portalled content (no React-tree propagation).
  it.skip('does not dismiss when pressing content inside a nested popover', async () => {
    const { user } = render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
              <Popover.Root>
                <Popover.Trigger>Open nested popover</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup>
                      <button type="button">Nested focusable content</button>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByRole('button', { name: 'Open nested popover' }));

    await user.click(await screen.findByRole('button', { name: 'Nested focusable content' }));

    expect(screen.getByRole('listbox')).not.toBe(null);
  });

  it('wraps modal focus from popup controls back to the input', async () => {
    const { user } = render(() => (
      <Combobox.Root defaultOpen modal>
        <Combobox.Trigger>Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
              <button type="button">Extra control</button>
              <Combobox.List>
                <Combobox.Item value="apple">Apple</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const extraControl = screen.getByRole('button', { name: 'Extra control' });

    input.focus();
    await user.tab();
    expect(extraControl).toHaveFocus();

    await user.tab();
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('does not cause infinite re-renders when items becomes undefined', async () => {
    const [items, setItems] = createSignal<string[] | undefined>([]);
    render(() => (
      <Combobox.Root items={items()} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    act(() => setItems(undefined));
  });

  it('hides the trigger when popup is open with input outside the popup', async () => {
    const { user } = render(() => (
      <div>
        <button data-testid="outside">Outside</button>
        <Combobox.Root items={['Apple', 'Banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
    ));

    await user.click(screen.getByTestId('input'));

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    const outside = screen.getByTestId('outside');
    const trigger = screen.getByTestId('trigger');

    await waitFor(() => {
      expect(isElementOrAncestorInert(outside)).toBe(true);
    });

    expect(isElementOrAncestorInert(trigger)).toBe(true);
  });

  it('does not render the start dismiss button while closed', async () => {
    render(() => (
      <Combobox.Root items={['Apple', 'Banana']}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBe(null);
  });

  it('renders internal dismiss buttons before the input and after the popup', async () => {
    const { user } = render(() => (
      <div>
        <button data-testid="outside">Outside</button>
        <Combobox.Root defaultOpen modal items={['Apple', 'Banana']}>
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup" aria-label="Demo">
                <Combobox.Input aria-label="Combobox input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
    ));

    const popup = screen.getByTestId('popup');
    const input = screen.getByRole('combobox', { name: 'Combobox input' });
    const [startDismissButton, endDismissButton] = screen.getAllByRole('button', {
      name: 'Dismiss',
    });
    const outside = screen.getByTestId('outside');

    expect(input.previousElementSibling).toBe(startDismissButton);
    expect(popup.nextElementSibling).toBe(endDismissButton);
    expect(startDismissButton).not.toHaveAttribute('tabindex');
    expect(endDismissButton).not.toHaveAttribute('tabindex');

    await waitFor(() => {
      expect(isElementOrAncestorInert(outside)).toBe(true);
    });

    await user.click(endDismissButton);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  it('renders an internal dismiss button for the input-outside-popup pattern', async () => {
    const { user } = render(() => (
      <Combobox.Root items={['Apple', 'Banana']}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    await user.click(screen.getByTestId('input'));

    const popup = await screen.findByTestId('popup');
    const input = screen.getByTestId('input');
    const [startDismissButton, endDismissButton] = screen.getAllByRole('button', {
      name: 'Dismiss',
    });

    expect(input.previousElementSibling).toBe(startDismissButton);
    expect(popup.nextElementSibling).toBe(endDismissButton);
    expect(startDismissButton).not.toHaveAttribute('tabindex');
    expect(endDismissButton).not.toHaveAttribute('tabindex');

    await user.click(startDismissButton);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  describe('selection behavior', () => {
    describe('single', () => {
      it('fires onOpenChange once with reason item-press on mouse click', async () => {
        const items = ['apple', 'banana'];
        const onOpenChange = spy();

        const { user } = render(() => (
          <Combobox.Root items={items} onOpenChange={onOpenChange}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByRole('combobox');
        await user.click(input);
        expect(screen.getByRole('listbox')).not.to.equal(null);

        onOpenChange.resetHistory();
        await user.click(screen.getByRole('option', { name: 'apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).to.equal(null);
        });

        expect(onOpenChange.callCount).to.equal(1);
        expect(onOpenChange.lastCall.args[0]).to.equal(false);
        expect(onOpenChange.lastCall.args[1].reason).to.equal(REASONS.itemPress);
        expect(onOpenChange.lastCall.args[1].event instanceof MouseEvent).to.equal(true);
      });

      it('fires onOpenChange once with reason item-press on Enter selection', async () => {
        const items = ['apple', 'banana'];
        const onOpenChange = spy();

        const { user } = render(() => (
          <Combobox.Root items={items} onOpenChange={onOpenChange}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByRole('combobox');
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

        await user.keyboard('{ArrowDown}');
        onOpenChange.resetHistory();
        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).to.equal(null);
        });

        expect(onOpenChange.callCount).to.equal(1);
        expect(onOpenChange.lastCall.args[0]).to.equal(false);
        expect(onOpenChange.lastCall.args[1].reason).to.equal(REASONS.itemPress);
        expect(onOpenChange.lastCall.args[1].event instanceof KeyboardEvent).to.equal(true);
      });

      it('should auto-close popup after selection when open state is uncontrolled', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = render(() => (
          <Combobox.Root items={items}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        expect(await screen.findByRole('listbox')).not.to.equal(null);
        expect(input).to.have.attribute('aria-expanded', 'true');

        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).to.equal(null);
        });
        expect(input).to.have.attribute('aria-expanded', 'false');
      });

      it('syncs selected index when items change after close', async () => {
        const { user } = render(() => <AsyncItemsCombobox />);

        const input = screen.getByTestId('input');
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

        await user.click(screen.getByRole('option', { name: 'Cherry' }));
        await waitFor(() => expect(screen.queryByRole('listbox')).to.equal(null));

        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

        const cherryOption = screen.getByRole('option', { name: 'Cherry' });
        expect(cherryOption).to.have.attribute('data-selected', '');
      });

      it('should not auto-close popup when open state is controlled', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = render(() => (
          <Combobox.Root items={items} open>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await user.click(screen.getByText('apple'));
        expect(screen.getByRole('listbox')).not.to.equal(null);
      });

      it('should show all items when query is empty with enhanced filter', async () => {
        const items = ['apple', 'banana', 'cherry'];

        render(() => (
          <Combobox.Root items={items} defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        expect(screen.queryByText('apple')).not.to.equal(null);
        expect(screen.queryByText('banana')).not.to.equal(null);
        expect(screen.queryByText('cherry')).not.to.equal(null);
      });

      it('should show all items when query matches current selection', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = render(() => (
          <Combobox.Root items={items} defaultValue="apple">
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);

        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        expect(input).to.have.value('apple');

        await user.click(trigger);

        expect(await screen.findByText('apple')).not.to.equal(null);
        expect(await screen.findByText('banana')).not.to.equal(null);
        expect(await screen.findByText('cherry')).not.to.equal(null);
      });

      it('should reset input value to selected value when popup closes without selection', async () => {
        const items = ['apple', 'banana', 'cherry'];
        const onInputValueChange = spy();

        const { user } = render(() => (
          <Combobox.Root items={items} defaultValue="apple" onInputValueChange={onInputValueChange}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        expect(input).to.have.value('apple');

        await user.click(trigger);
        await user.type(input, 'xyz');
        expect(input).to.have.value('applexyz');

        await user.click(document.body);

        await waitFor(() => expect(input).to.have.value('apple'));
        expect(onInputValueChange.lastCall.args[0]).to.equal('apple');
        expect(onInputValueChange.lastCall.args[1].reason).to.equal('none');
      });

      it('should not auto-close during browser autofill', async () => {
        const items = ['apple', 'banana', 'cherry'];

        render(() => (
          <Combobox.Root items={items} name="test" defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        expect(screen.getByRole('listbox')).not.to.equal(null);

        const hiddenInput = screen.queryByRole('textbox', { hidden: true });
        fireEvent.input(hiddenInput!, { target: { value: 'apple' } });

        await flushMicrotasks();

        expect(screen.getByRole('listbox')).not.to.equal(null);
      });

      it.skipIf(isJSDOM)(
        'highlights and scrolls the selected item into view on first open (no items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          const { user } = render(() => (
            <Combobox.Root defaultValue="banana">
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="apple">apple</Combobox.Item>
                      <Combobox.Item value="banana">banana</Combobox.Item>
                      <Combobox.Item value="cherry">cherry</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          ));

          const input = screen.getByTestId('input');
          await user.click(input);

          const selectedItem = await screen.findByRole('option', { name: 'banana' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', selectedItem.id);
          });
          await waitFor(() => {
            expect(scrollIntoView.mock.contexts).toEqual([selectedItem]);
          });
          expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
        },
      );

      it.skipIf(isJSDOM)(
        'highlights and scrolls the selected item into view on mount when inline (items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          render(() => (
            <Combobox.Root items={['apple', 'banana', 'cherry']} inline open defaultValue="banana">
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Root>
          ));

          const input = screen.getByTestId('input');
          const selectedItem = await screen.findByRole('option', { name: 'banana' });

          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', selectedItem.id);
          });
          await waitFor(() => {
            expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
          });
        },
      );

      it.skipIf(isJSDOM)(
        'does not restore the initial highlight after focus leaves an inline input (items prop)',
        async () => {
          function App() {
            const [value, setValue] = createSignal<string | null>('banana');

            return (
              <Combobox.Root
                items={['apple', 'banana', 'cherry']}
                inline
                open
                value={value()}
                onValueChange={setValue}
              >
                <Combobox.Input data-testid="input" />
                <button type="button" onClick={() => setValue('cherry')}>
                  Change value
                </button>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Root>
            );
          }

          const { user } = render(() => <App />);
          const input = screen.getByTestId('input');
          const banana = await screen.findByRole('option', { name: 'banana' });

          await waitFor(() => {
            expect(banana).toHaveAttribute('data-highlighted');
          });

          await user.click(input);
          await user.click(screen.getByRole('button', { name: 'Change value' }));

          await waitFor(() => {
            expect(input).not.toHaveAttribute('aria-activedescendant');
          });
          expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
            'data-highlighted',
          );
        },
      );

      it.skipIf(isJSDOM)(
        'does not apply the initial highlight when a selection resolves after blur (items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          function App() {
            const [value, setValue] = createSignal<string | null>(null);

            return (
              <>
                <Combobox.Root
                  items={['apple', 'banana', 'cherry']}
                  inline
                  open
                  value={value()}
                  onValueChange={setValue}
                >
                  <Combobox.Input data-testid="input" />
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Root>
                <button type="button">Blur target</button>
                <button type="button" onClick={() => setValue('banana')}>
                  Resolve selection
                </button>
              </>
            );
          }

          const { user } = render(() => <App />);
          const input = screen.getByTestId('input');

          await user.click(input);
          await user.click(screen.getByRole('button', { name: 'Blur target' }));
          await user.click(screen.getByRole('button', { name: 'Resolve selection' }));

          const selectedItem = screen.getByRole('option', { name: 'banana' });
          expect(selectedItem).not.toHaveAttribute('data-highlighted');
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(scrollIntoView).not.toHaveBeenCalled();
        },
      );

      it.skipIf(isJSDOM)(
        'does not snap the highlight to a stale index while filtering an inline list (items prop)',
        async () => {
          // The selected item survives filtering but shifts index: `banana` is at unfiltered
          // index 1, but after typing `b` the visible list is `[banana, blueberry]` so index 1
          // is `blueberry`. Recomputing the frozen selected index against the unfiltered list
          // would highlight `blueberry`.
          const { user } = render(() => (
            <Combobox.Root
              items={['apple', 'banana', 'blueberry', 'cherry']}
              inline
              open
              defaultValue="banana"
            >
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Root>
          ));

          const input = screen.getByTestId('input');
          const banana = await screen.findByRole('option', { name: 'banana' });
          await waitFor(() => {
            expect(banana).toHaveAttribute('data-highlighted');
          });

          await user.click(input);
          await user.keyboard('b');

          await waitFor(() => {
            expect(screen.queryByRole('option', { name: 'cherry' })).toBe(null);
          });

          // Typing without `autoHighlight` clears the highlight; it must not be re-derived from
          // a stale unfiltered index onto a different item.
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(screen.getByRole('option', { name: 'blueberry' })).not.toHaveAttribute(
            'data-highlighted',
          );
        },
      );

      it.skipIf(isJSDOM)(
        'does not transfer a stale highlight when clearing an inline list without a selection (items prop)',
        async () => {
          const { user } = render(() => (
            <Combobox.Root items={['apple', 'banana', 'blueberry', 'cherry']} inline open>
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Root>
          ));

          const input = screen.getByTestId('input');
          await user.type(input, 'b');
          await user.keyboard('{ArrowDown}{ArrowDown}');

          const blueberry = screen.getByRole('option', { name: 'blueberry' });
          await waitFor(() => {
            expect(blueberry).toHaveAttribute('data-highlighted');
          });

          await user.clear(input);

          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
            'data-highlighted',
          );
        },
      );

      it.skipIf(isJSDOM)(
        'waits for a controlled query clear to commit before restoring the selection (items prop)',
        async () => {
          function App() {
            // Solid: components do not re-render, so React's forced re-render is a no-op here.
            const forceRender = () => {};

            return (
              <Combobox.Root
                items={['apple', 'banana', 'blueberry', 'cherry']}
                defaultValue="banana"
                inputValue="b"
                onInputValueChange={() => {}}
                defaultOpen
              >
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.Input data-testid="input" />
                      <ClearActiveIndexButton />
                      <button type="button" onClick={forceRender}>
                        Rerender
                      </button>
                      <Combobox.List>
                        {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            );
          }

          const { user } = render(() => <App />);
          const input = screen.getByTestId('input');
          const banana = await screen.findByRole('option', { name: 'banana' });

          await user.click(screen.getByRole('button', { name: 'Clear highlight' }));
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(banana).not.toHaveAttribute('data-highlighted');

          await user.clear(input);
          expect(input).toHaveValue('b');
          expect(banana).not.toHaveAttribute('data-highlighted');

          await user.click(screen.getByRole('button', { name: 'Rerender' }));
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(banana).not.toHaveAttribute('data-highlighted');
        },
      );

      it.skipIf(isJSDOM)(
        'highlights the first selected item on mount and keeps the highlight when toggling in a multiple inline list (items prop)',
        async () => {
          const { user } = render(() => (
            <Combobox.Root
              items={['apple', 'banana', 'cherry', 'date', 'elderberry']}
              inline
              open
              multiple
              defaultValue={['apple', 'date']}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Root>
          ));

          const input = screen.getByTestId('input');
          const date = await screen.findByRole('option', { name: 'date' });
          const apple = screen.getByRole('option', { name: 'apple' });

          // Initial highlight follows the first selected value in rendered order.
          await waitFor(() => {
            expect(apple).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', apple.id);
          });

          // Deselecting must not jump the highlight (and scroll) to the other selected item.
          await user.click(date);

          await waitFor(() => {
            expect(date).toHaveAttribute('aria-selected', 'false');
          });
          expect(apple).not.toHaveAttribute('data-highlighted');
          expect(input).not.toHaveAttribute('aria-activedescendant', apple.id);
        },
      );

      it.skipIf(isJSDOM)(
        'does not highlight a non-selected item when an initial input value pre-filters the inline list (items prop)',
        async () => {
          // The selected value is filtered out by the initial input value, but its unfiltered
          // index stays in range of the filtered list. Resolving that index against the
          // unfiltered list would highlight whichever item now occupies that slot.
          render(() => (
            <Combobox.Root
              items={['b0', 'sel', 'b1', 'b2', 'b3']}
              inline
              open
              defaultValue="sel"
              defaultInputValue="b"
            >
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Root>
          ));

          const input = screen.getByTestId('input');
          const b1 = await screen.findByRole('option', { name: 'b1' });
          await waitFor(() => {
            expect(screen.queryByRole('option', { name: 'sel' })).toBe(null);
          });

          expect(b1).not.toHaveAttribute('data-highlighted');
          expect(input).not.toHaveAttribute('aria-activedescendant');
        },
      );

      it.skipIf(isJSDOM)(
        'does not replace a pointer highlight when the initial selection resolves after mount (items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          // Solid: props that the React test changes with `setProps` are held in a signal.
          const [rootProps, setRootProps] = createSignal<Record<string, any>>({
            items: ['apple', 'cherry'],
          });
          const { user } = render(() => (
            <Combobox.Root items={rootProps().items} inline open defaultValue="banana">
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Root>
          ));

          const input = screen.getByTestId('input');
          const apple = await screen.findByRole('option', { name: 'apple' });
          await user.hover(apple);

          await waitFor(() => {
            expect(apple).toHaveAttribute('data-highlighted');
          });

          act(() => setRootProps((prev) => ({ ...prev, items: ['apple', 'banana', 'cherry'] })));
          await act(async () => {
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => resolve());
            });
          });

          expect(apple).toHaveAttribute('data-highlighted');
          expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
            'data-highlighted',
          );
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
          expect(scrollIntoView).not.toHaveBeenCalled();
        },
      );

      it.skipIf(isJSDOM)(
        'does not restore the initial highlight after pointer navigation is cleared (items prop)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          // Solid: props that the React test changes with `setProps` are held in a signal.
          const [rootProps, setRootProps] = createSignal<Record<string, any>>({
            items: ['apple', 'cherry'],
          });
          const { user } = render(() => (
            <Combobox.Root items={rootProps().items} inline open defaultValue="banana">
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Root>
          ));

          const input = screen.getByTestId('input');
          const apple = await screen.findByRole('option', { name: 'apple' });
          await user.hover(apple);

          await waitFor(() => {
            expect(apple).toHaveAttribute('data-highlighted');
          });

          await user.unhover(apple);
          await waitFor(() => {
            expect(apple).not.toHaveAttribute('data-highlighted');
          });

          scrollIntoView.mockClear();
          act(() => setRootProps((prev) => ({ ...prev, items: ['apple', 'banana', 'cherry'] })));

          expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
            'data-highlighted',
          );
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(scrollIntoView).not.toHaveBeenCalled();
        },
      );

      it.skipIf(isJSDOM)(
        'emits the selected item index to onItemHighlighted on mount when inline and virtualized (items prop)',
        async () => {
          const onItemHighlighted = vi.fn();
          const items = Array.from({ length: 50 }, (_, index) => `item-${index}`);

          render(() => (
            <Combobox.Root
              items={items}
              inline
              open
              virtualized
              defaultValue="item-30"
              onItemHighlighted={onItemHighlighted}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.List>
                {items.map((item, index) => (
                  <Combobox.Item value={item} index={index}>
                    {item}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            </Combobox.Root>
          ));

          await waitFor(() => {
            expect(onItemHighlighted).toHaveBeenCalledWith(
              'item-30',
              expect.objectContaining({ index: 30 }),
            );
          });
        },
      );

      it.skipIf(isJSDOM)(
        'restores the highlight and scroll to the selected item when the query is cleared',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());

          const { user } = render(() => (
            <Combobox.Root items={['apple', 'banana', 'cherry']} defaultValue="banana">
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          ));

          await user.click(screen.getByTestId('trigger'));
          const input = await screen.findByTestId('input');

          // Move the highlight away from the selected item by filtering.
          await user.type(input, 'cherry');
          await waitFor(() => {
            expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
          });

          scrollIntoView.mockClear();

          // Clearing the query should restore the highlight to the selected item.
          await user.clear(input);

          const selectedItem = await screen.findByRole('option', { name: 'banana' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', selectedItem.id);
          });
          await waitFor(() => {
            expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
          });
        },
      );

      it.skipIf(isJSDOM)(
        'restores the selected direct item after its registration index changes',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi
            .spyOn(HTMLElement.prototype, 'scrollIntoView')
            .mockImplementation(() => {});
          onTestFinished(() => scrollIntoView.mockRestore());

          const onItemHighlighted = vi.fn();

          function App() {
            const [query, setQuery] = createSignal('');
            const visibleItems = () => (query() ? ['cherry'] : ['apple', 'banana', 'cherry']);

            return (
              <Combobox.Root
                onInputValueChange={setQuery}
                defaultValue="banana"
                defaultOpen
                autoHighlight
                onItemHighlighted={onItemHighlighted}
              >
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.Input data-testid="input" />
                      <Combobox.List>
                        <For each={visibleItems()}>
                          {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                        </For>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            );
          }

          const { user } = render(() => <App />);
          const input = screen.getByTestId('input');

          await user.type(input, 'c');
          const cherry = await screen.findByRole('option', { name: 'cherry' });
          fireEvent.mouseMove(cherry, { pointerType: 'mouse' });
          await waitFor(() => expect(cherry).toHaveAttribute('data-highlighted'));
          await act(async () => new Promise(requestAnimationFrame));

          scrollIntoView.mockClear();
          onItemHighlighted.mockClear();
          await user.clear(input);

          const banana = await screen.findByRole('option', { name: 'banana' });
          await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
          await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', banana.id));
          // Interim registrations may scroll transiently before paint; the final scroll
          // must land on the restored selected item.
          await waitFor(() => expect(scrollIntoView.mock.contexts.at(-1)).toBe(banana));
          expect(scrollIntoView.mock.lastCall).toEqual([{ block: 'nearest', inline: 'nearest' }]);
          expect(onItemHighlighted.mock.lastCall?.[0]).toBe('banana');

          // The restore must never report an item at an index it does not occupy: the
          // re-mounted items publish their real indices a commit later, so reading the
          // registry too early pairs the selected item with a stale index.
          const positions: Record<string, number> = { apple: 0, banana: 1, cherry: 2 };
          const inconsistent = onItemHighlighted.mock.calls
            .filter(([item]) => item != null)
            .filter(([item, details]) => positions[item] !== details.index)
            .map(([item, details]) => `${item}@${details.index}`);
          expect(inconsistent).toEqual([]);
        },
      );

      it('does not navigate kept-mounted items while controlled closed', async () => {
        const { user } = render(() => (
          <Combobox.Root items={['apple', 'banana']} open={false} autoHighlight>
            <Combobox.Input data-testid="input" />
            <ActiveIndexProbe />
            <Combobox.Portal keepMounted>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await user.type(screen.getByTestId('input'), 'banana');

        expect(screen.getByTestId('active-index')).toHaveTextContent('null');
        expect(screen.getByTestId('input')).not.toHaveAttribute('aria-activedescendant');
      });

      it('restores the selected item with the input outside the popup', async () => {
        const { user } = render(() => (
          <Combobox.Root items={['apple', 'banana', 'cherry']} value="banana" defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.type(input, 'cherry');
        await waitFor(() => expect(screen.queryByRole('option', { name: 'banana' })).toBe(null));

        await user.clear(input);

        const banana = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
        expect(input).toHaveAttribute('aria-activedescendant', banana.id);
      });

      it.skipIf(isJSDOM)(
        'scrolls to programmatic highlights after the filtered list changes',
        async () => {
          const items = Array.from(
            { length: 200 },
            (_, index) => `item-${String(index).padStart(3, '0')}`,
          );
          const { user } = render(() => (
            <Combobox.Root items={items} defaultValue="item-180" autoHighlight>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input data-testid="input" />
                    <Combobox.List
                      data-testid="list"
                      style={{ 'max-height': '100px', overflow: 'auto' }}
                    >
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          ));

          await user.click(screen.getByTestId('trigger'));
          const input = await screen.findByTestId('input');
          const list = screen.getByTestId('list');
          list.scrollTop = list.scrollHeight;

          await user.type(input, '9');

          const firstMatch = await screen.findByRole('option', { name: 'item-009' });
          await waitFor(() => {
            expect(firstMatch).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(list.scrollTop).toBe(0);
          });

          list.scrollTop = list.scrollHeight;
          await user.clear(input);

          const selectedItem = await screen.findByRole('option', { name: 'item-180' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            const listRect = list.getBoundingClientRect();
            const selectedRect = selectedItem.getBoundingClientRect();
            expect(selectedRect.top >= listRect.top && selectedRect.bottom <= listRect.bottom).toBe(
              true,
            );
          });
        },
      );

      it('restores the selected item instead of the first item when clearing with autoHighlight', async () => {
        const { user } = render(() => (
          <Combobox.Root items={['apple', 'banana', 'cherry']} defaultValue="banana" autoHighlight>
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input data-testid="input" />
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        // With autoHighlight, filtering strongly highlights the first match.
        await user.type(input, 'a');
        const appleItem = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });

        // Clearing should return the highlight to the selected item, not the first item.
        await user.clear(input);

        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('emits onItemHighlighted for the selected item when the query is cleared', async () => {
        const onItemHighlighted = vi.fn();

        const { user } = render(() => (
          <Combobox.Root
            items={['apple', 'banana', 'cherry']}
            defaultValue="banana"
            onItemHighlighted={onItemHighlighted}
          >
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input data-testid="input" />
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'cherry');
        onItemHighlighted.mockClear();

        await user.clear(input);

        // The consumer receives a programmatic (`none`) highlight for the selected item,
        // which virtualized lists rely on to scroll it into view.
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'banana',
            expect.objectContaining({ reason: REASONS.none, index: 1 }),
          );
        });
      });

      it.skipIf(isJSDOM)(
        'restores the selected item through an externally virtualized list',
        async () => {
          const items = Array.from(
            { length: 100 },
            (_, index) => `item-${String(index).padStart(3, '0')}`,
          );
          const scrollToIndex = vi.fn();

          function VirtualizedItems(props: {
            windowStart: number;
            setWindowStart: (value: number) => void;
          }) {
            const filteredItems = Combobox.useFilteredItems<string>();

            createEffect(
              () => filteredItems().length,
              (length) => {
                if (length < items.length) {
                  props.setWindowStart(0);
                }
              },
            );

            return (
              <For each={filteredItems().slice(props.windowStart, props.windowStart + 10)}>
                {(item, offset) => (
                  <Combobox.Item value={item} index={props.windowStart + offset()}>
                    {item}
                  </Combobox.Item>
                )}
              </For>
            );
          }

          function App() {
            const [windowStart, setWindowStart] = createSignal(80);

            return (
              <Combobox.Root
                items={items}
                defaultValue="item-080"
                virtualized
                onItemHighlighted={(item, { index }) => {
                  if (item) {
                    scrollToIndex(index);
                    queueMicrotask(() => setWindowStart(index));
                  }
                }}
              >
                <Combobox.Trigger data-testid="trigger">
                  <Combobox.Value />
                </Combobox.Trigger>
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.Input data-testid="input" />
                      <Combobox.List>
                        <VirtualizedItems
                          windowStart={windowStart()}
                          setWindowStart={setWindowStart}
                        />
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            );
          }

          const { user } = render(() => <App />);
          await user.click(screen.getByTestId('trigger'));
          const input = await screen.findByTestId('input');

          await user.type(input, 'item-000');
          await screen.findByRole('option', { name: 'item-000' });
          scrollToIndex.mockClear();

          await user.clear(input);

          await waitFor(() => {
            expect(scrollToIndex).toHaveBeenCalledWith(80);
          });
          const selectedItem = await screen.findByRole('option', { name: 'item-080' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(input).toHaveAttribute('aria-activedescendant', selectedItem.id);
          });
        },
      );

      it('consumes a query-clear restore when the selected item is absent', async () => {
        const onItemHighlighted = vi.fn();
        function App() {
          const [inputValue, setInputValue] = createSignal('');
          const [includeSelected, setIncludeSelected] = createSignal(true);
          const visibleItems = () => {
            if (inputValue()) {
              return ['apple'];
            }
            if (includeSelected()) {
              return ['apple', 'banana', 'cherry'];
            }
            return ['apple', 'cherry'];
          };

          return (
            <Combobox.Root
              inputValue={inputValue()}
              onInputValueChange={setInputValue}
              defaultValue="banana"
              defaultOpen
              autoHighlight
              onItemHighlighted={onItemHighlighted}
            >
              <ActiveIndexProbe />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input data-testid="input" />
                    <button type="button" onClick={() => setIncludeSelected(false)}>
                      Remove selected item
                    </button>
                    <Combobox.List>
                      <For each={visibleItems()}>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </For>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = render(() => <App />);
        const input = screen.getByTestId('input');
        await user.type(input, 'a');
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Remove selected item' }));
        onItemHighlighted.mockClear();
        await user.clear(input);
        await waitFor(() => {
          expect(screen.getAllByRole('option')).toHaveLength(2);
        });
        expect(screen.getByTestId('active-index')).toHaveTextContent('null');
        expect(onItemHighlighted.mock.calls.some(([item]) => item === 'banana')).toBe(false);
      });

      it('clears selectedIndex when the value is cleared externally while closed (no items prop)', async () => {
        function App() {
          const [value, setValue] = createSignal<string | null>('banana');

          return (
            <div>
              <Combobox.Root value={value()} onValueChange={setValue}>
                <Combobox.Input data-testid="input" />
                <SelectedIndexProbe />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">apple</Combobox.Item>
                        <Combobox.Item value="banana">banana</Combobox.Item>
                        <Combobox.Item value="cherry">cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button type="button" data-testid="external-clear" onClick={() => setValue(null)}>
                Clear
              </button>
            </div>
          );
        }

        const { user } = render(() => <App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        await user.click(screen.getByTestId('external-clear'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      it('clears selectedIndex when the value is set to an unmatched value while closed (no items prop)', async () => {
        function App() {
          const [value, setValue] = createSignal<string | null>('banana');

          return (
            <div>
              <Combobox.Root value={value()} onValueChange={setValue}>
                <Combobox.Input data-testid="input" />
                <SelectedIndexProbe />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">apple</Combobox.Item>
                        <Combobox.Item value="banana">banana</Combobox.Item>
                        <Combobox.Item value="cherry">cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button
                type="button"
                data-testid="external-set"
                onClick={() => setValue('dragonfruit')}
              >
                Set
              </button>
            </div>
          );
        }

        const { user } = render(() => <App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        await user.click(screen.getByTestId('external-set'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      it('registers selectedIndex before opening with a keepMounted portal (no items prop)', async () => {
        function App() {
          return (
            <Combobox.Root defaultValue="banana">
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <Combobox.Portal keepMounted>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="apple">apple</Combobox.Item>
                      <Combobox.Item value="banana">banana</Combobox.Item>
                      <Combobox.Item value="cherry">cherry</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        render(() => <App />);

        // The portal mounts its children in a second commit, so the index is
        // asserted by the mounted item itself while still closed.
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });
      });

      it('does not highlight the previous item after the value changes while open (no items prop)', async () => {
        const onItemHighlighted = vi.fn();

        function App() {
          const [value, setValue] = createSignal<string | null>('banana');

          return (
            <div>
              <Combobox.Root
                value={value()}
                onValueChange={setValue}
                onItemHighlighted={onItemHighlighted}
              >
                <Combobox.Input data-testid="input" />
                <SelectedIndexProbe />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">apple</Combobox.Item>
                        <Combobox.Item value="banana">banana</Combobox.Item>
                        <Combobox.Item value="cherry">cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button type="button" data-testid="external-set" onClick={() => setValue('cherry')}>
                Set
              </button>
            </div>
          );
        }

        const { user } = render(() => <App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });

        // Change the value externally while the popup is open. `fireEvent` avoids the
        // outside-press dismiss a real pointer interaction would trigger.
        fireEvent.click(screen.getByTestId('external-set'));
        await flushMicrotasks();
        expect(screen.getByRole('listbox')).not.toBe(null);

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        // Closing reconciles the index to the new selection (cherry).
        expect(screen.getByTestId('selected-index').textContent).toBe('2');

        onItemHighlighted.mockClear();
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'cherry' })).toHaveAttribute(
            'data-highlighted',
          );
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(
          onItemHighlighted.mock.calls.some(([highlightedValue]) => highlightedValue === 'banana'),
        ).toBe(false);
      });

      it('re-highlights the selection on reopen when the value object is recreated with equal contents (no items prop)', async () => {
        const onItemHighlighted = vi.fn();
        const apple = { id: 1, label: 'apple' };
        const banana = { id: 2, label: 'banana' };
        const cherry = { id: 3, label: 'cherry' };
        const isItemEqualToValue = (a: any, b: any) => a.id === b.id;

        function App() {
          // Solid: components do not re-render; `force` recreates the controlled value object
          // with the same id, as React's re-render does.
          const [value, setValue] = createSignal({ id: 2, label: 'banana' });
          const force = () => setValue({ id: 2, label: 'banana' });

          return (
            <div>
              <Combobox.Root
                value={value()}
                isItemEqualToValue={isItemEqualToValue}
                onItemHighlighted={onItemHighlighted}
                itemToStringLabel={(v: any) => v.label}
              >
                <Combobox.Input data-testid="input" />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value={apple}>apple</Combobox.Item>
                        <Combobox.Item value={banana}>banana</Combobox.Item>
                        <Combobox.Item value={cherry}>cherry</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <button type="button" data-testid="force" onClick={force}>
                force
              </button>
            </div>
          );
        }

        const { user } = render(() => <App />);
        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'banana' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        // Rerender while closed so the value object is recreated with the same id.
        fireEvent.click(screen.getByTestId('force'));
        await flushMicrotasks();

        onItemHighlighted.mockClear();
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'banana' })).toHaveAttribute(
            'data-highlighted',
          );
        });
        expect(
          onItemHighlighted.mock.calls.some(([v]) => v && v.id !== undefined && v.id !== 2),
        ).toBe(false);
      });
    });

    describe('multiple', () => {
      it('should handle multiple selection', async () => {
        const handleValueChange = spy();

        const { user } = render(() => (
          <Combobox.Root multiple onValueChange={handleValueChange}>
            <Combobox.Input />
            <Combobox.List>
              <Combobox.Item value="a">a</Combobox.Item>
              <Combobox.Item value="b">b</Combobox.Item>
              <Combobox.Item value="c">c</Combobox.Item>
            </Combobox.List>
          </Combobox.Root>
        ));

        const optionA = screen.getByRole('option', { name: 'a' });
        await user.click(optionA);

        expect(handleValueChange.callCount).to.equal(1);
        expect(handleValueChange.args[0][0]).to.deep.equal(['a']);

        const optionB = screen.getByRole('option', { name: 'b' });
        await user.click(optionB);

        expect(handleValueChange.callCount).to.equal(2);
        expect(handleValueChange.args[1][0]).to.deep.equal(['a', 'b']);
      });

      it('opens with an empty input and highlights the first selected item (input inside popup)', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = render(() => (
          <MultiplePopupCombobox onItemHighlighted={onItemHighlighted} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        const appleItem = screen.getByRole('option', { name: 'apple' });
        const bananaItem = screen.getByRole('option', { name: 'banana' });

        expect(input).toHaveValue('');
        expect(appleItem).toHaveAttribute('aria-selected', 'true');
        expect(bananaItem).toHaveAttribute('aria-selected', 'true');
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ reason: REASONS.none, index: 0 }),
          );
        });
      });

      it('anchors the highlight to the first selected item in rendered order regardless of value order', async () => {
        // `apple` renders first but sits in the middle of the value array, so neither end of
        // that array points at it and only the rendered order does.
        const { user } = render(() => (
          <MultiplePopupCombobox defaultValue={['banana', 'apple', 'cherry']} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        const appleItem = screen.getByRole('option', { name: 'apple' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('anchors the highlight to the first selected item with individually rendered items', async () => {
        const { user } = render(() => (
          <Combobox.Root multiple defaultValue={['banana', 'apple', 'cherry']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {['apple', 'banana', 'cherry'].map((item) => (
                      <Combobox.Item value={item}>{item}</Combobox.Item>
                    ))}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.click(input);
        const appleItem = await screen.findByRole('option', { name: 'apple' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('anchors to the first selected item in rendered order across groups', async () => {
        // `spinach` renders first but is not the last value, so anchoring to the rendered order
        // and anchoring to the end of the value array give different answers.
        const { user } = render(() => (
          <Combobox.Root multiple defaultValue={['spinach', 'plum']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Group>
                      <Combobox.GroupLabel>Vegetables</Combobox.GroupLabel>
                      <Combobox.Item value="artichoke">artichoke</Combobox.Item>
                      <Combobox.Item value="spinach">spinach</Combobox.Item>
                    </Combobox.Group>
                    <Combobox.Group>
                      <Combobox.GroupLabel>Fruits</Combobox.GroupLabel>
                      <Combobox.Item value="apple">apple</Combobox.Item>
                      <Combobox.Item value="plum">plum</Combobox.Item>
                    </Combobox.Group>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.click(input);

        const spinachItem = await screen.findByRole('option', { name: 'spinach' });
        await waitFor(() => {
          expect(spinachItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', spinachItem.id);
        });
        expect(screen.getByRole('option', { name: 'plum' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('keeps the highlight on an item a controlled value refused to select', async () => {
        // A controlled consumer may decline the change without calling `cancel()`. The query
        // still clears, and the highlight stays on the item that was pressed, matching what
        // happens when the same item is pressed without a query active.
        function App() {
          const value = ['apple'];
          return (
            <Combobox.Root
              items={['apple', 'banana', 'cherry']}
              multiple
              value={value}
              onValueChange={() => {}}
            >
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = render(() => <App />);

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'banana');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

        await user.click(screen.getByRole('option', { name: 'banana' }));
        await waitFor(() => {
          expect(input).toHaveValue('');
        });

        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
        expect(bananaItem).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('anchors to the first selected item when opened with the keyboard', async () => {
        const { user } = render(() => (
          <MultiplePopupCombobox defaultValue={['banana', 'cherry']} />
        ));

        const trigger = screen.getByTestId('trigger');
        await user.keyboard('{Tab}');
        expect(trigger).toHaveFocus();
        await user.keyboard('{ArrowDown}');

        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'cherry' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('continues arrow navigation from the anchor rather than the top of the list', async () => {
        const { user } = render(() => (
          <MultiplePopupCombobox defaultValue={['banana', 'cherry']} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        // Focus reaches the input asynchronously. Keys sent before it lands are lost.
        await waitFor(() => {
          expect(input).toHaveFocus();
        });
        const bananaItem = await screen.findByRole('option', { name: 'banana' });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });

        // The next item after the anchor, not `apple` at the top.
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'cherry' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('data-highlighted');
        });
      });

      it('keeps the toggled item highlighted when selecting with the keyboard while filtering', async () => {
        const { user } = render(() => <MultiplePopupCombobox />);

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'cherry');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'cherry' })).toHaveAttribute(
            'data-highlighted',
          );
        });

        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(input).toHaveValue('');
        });

        const cherryItem = await screen.findByRole('option', { name: 'cherry' });
        await waitFor(() => {
          expect(cherryItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('moves the anchor when the anchor item value changes', async () => {
        function App(props: { replaceApple?: boolean }) {
          return (
            <Combobox.Root multiple defaultValue={['apple', 'cherry']}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <Combobox.Portal keepMounted>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value={props.replaceApple ? 'date' : 'apple'}>
                        {props.replaceApple ? 'date' : 'apple'}
                      </Combobox.Item>
                      <Combobox.Item value="banana">banana</Combobox.Item>
                      <Combobox.Item value="cherry">cherry</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        // Solid: props that the React test changes with `setProps` are held in a signal.
        const [rootProps, setRootProps] = createSignal<Record<string, any>>({
          replaceApple: undefined,
        });
        render(() => <App replaceApple={rootProps().replaceApple} />);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        act(() => setRootProps((prev) => ({ ...prev, replaceApple: true })));

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('2');
        });
      });

      it('moves the anchor to the next selected item when the anchor item leaves the list', async () => {
        function App(props: { hideApple?: boolean }) {
          const visible = () =>
            props.hideApple ? ['banana', 'cherry'] : ['apple', 'banana', 'cherry'];

          return (
            <Combobox.Root multiple defaultValue={['apple', 'cherry']}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <Combobox.Portal keepMounted>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <For each={visible()}>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </For>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        // Solid: props that the React test changes with `setProps` are held in a signal.
        const [rootProps, setRootProps] = createSignal<Record<string, any>>({
          hideApple: undefined,
        });
        render(() => <App hideApple={rootProps().hideApple} />);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        act(() => setRootProps((prev) => ({ ...prev, hideApple: true })));

        // `banana` now occupies index 0 but is not selected, so `cherry` takes the anchor.
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('1');
        });
      });

      it('restores the anchor rather than the toggled item when deselecting while filtering', async () => {
        const { user } = render(() => <MultiplePopupCombobox />);

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'banana');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

        await user.click(screen.getByRole('option', { name: 'banana' }));
        await waitFor(() => {
          expect(input).toHaveValue('');
        });

        const appleItem = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
        expect(screen.getByTestId('active-index')).toHaveTextContent('0');
      });

      it('restores the highlight to the first selected item when clearing (input inside popup)', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = render(() => (
          <MultiplePopupCombobox onItemHighlighted={onItemHighlighted} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');

        await user.type(input, 'banana');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
        });

        onItemHighlighted.mockClear();
        await user.clear(input);

        const appleItem = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ reason: REASONS.none, index: 0 }),
          );
        });
        expect(onItemHighlighted).toHaveBeenCalledTimes(1);
      });

      it('keeps the popup open and highlights the newly selected item after clearing its query', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = render(() => (
          <MultiplePopupCombobox defaultValue={['apple']} onItemHighlighted={onItemHighlighted} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'cherry');
        const cherryItem = await screen.findByRole('option', { name: 'cherry' });

        onItemHighlighted.mockClear();
        await user.click(cherryItem);

        await waitFor(() => {
          expect(input).toHaveValue('');
        });
        expect(screen.getByRole('listbox')).not.toBe(null);
        expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        await waitFor(() => {
          expect(cherryItem).toHaveAttribute('aria-selected', 'true');
        });
        await waitFor(() => {
          expect(cherryItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(input).toHaveAttribute('aria-activedescendant', cherryItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('2');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'cherry',
            expect.objectContaining({ reason: REASONS.none, index: 2 }),
          );
        });
      });

      it('keeps the toggled item highlighted when deselecting a selected item', async () => {
        const { user } = render(() => <MultiplePopupCombobox />);

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        const appleItem = screen.getByRole('option', { name: 'apple' });
        const bananaItem = screen.getByRole('option', { name: 'banana' });

        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await user.click(bananaItem);

        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('aria-selected', 'false');
        });
        expect(screen.getByRole('listbox')).not.toBe(null);
        expect(appleItem).toHaveAttribute('aria-selected', 'true');
        expect(appleItem).not.toHaveAttribute('data-highlighted');
        expect(bananaItem).toHaveAttribute('data-highlighted');
        expect(input).toHaveAttribute('aria-activedescendant', bananaItem.id);
        expect(screen.getByTestId('active-index')).toHaveTextContent('1');
      });

      it('clears the highlight when filtering deselects the only selected item', async () => {
        const { user } = render(() => <MultiplePopupCombobox defaultValue={['banana']} />);

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'banana');
        const bananaItem = await screen.findByRole('option', { name: 'banana' });

        await user.click(bananaItem);

        await waitFor(() => {
          expect(input).toHaveValue('');
        });
        await waitFor(() => {
          expect(bananaItem).toHaveAttribute('aria-selected', 'false');
        });
        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(screen.getByTestId('active-index')).toHaveTextContent('null');
        expect(
          screen.getAllByRole('option').some((item) => item.hasAttribute('data-highlighted')),
        ).toBe(false);
      });

      it('clears a closing query and restores the first selected item on reopen', async () => {
        const onItemHighlighted = vi.fn();
        const { user } = render(() => (
          <MultiplePopupCombobox onItemHighlighted={onItemHighlighted} />
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'cherry');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        onItemHighlighted.mockClear();
        await user.click(screen.getByTestId('trigger'));

        const reopenedInput = await screen.findByTestId('input');
        const appleItem = await screen.findByRole('option', { name: 'apple' });
        expect(reopenedInput).toHaveValue('');
        await waitFor(() => {
          expect(appleItem).toHaveAttribute('data-highlighted');
        });
        await waitFor(() => {
          expect(reopenedInput).toHaveAttribute('aria-activedescendant', appleItem.id);
        });
        await waitFor(() => {
          expect(screen.getByTestId('active-index')).toHaveTextContent('0');
        });
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalledWith(
            'apple',
            expect.objectContaining({ reason: REASONS.none, index: 0 }),
          );
        });
      });

      it.skipIf(isJSDOM)(
        'scrolls the first selected item into view when clearing (input inside popup)',
        async ({ onTestFinished }) => {
          const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
          onTestFinished(() => scrollIntoView.mockRestore());
          const items = Array.from({ length: 100 }, (_, index) => `item ${index}`);
          const { user } = render(() => (
            <MultiplePopupCombobox items={items} defaultValue={['item 90', 'item 80']} />
          ));

          await user.click(screen.getByTestId('trigger'));
          const input = await screen.findByTestId('input');
          await user.type(input, 'item 0');
          await waitFor(() => {
            expect(screen.queryByRole('option', { name: 'item 80' })).toBe(null);
          });

          scrollIntoView.mockClear();
          await user.clear(input);

          const selectedItem = await screen.findByRole('option', { name: 'item 80' });
          await waitFor(() => {
            expect(selectedItem).toHaveAttribute('data-highlighted');
          });
          await waitFor(() => {
            expect(screen.getByTestId('active-index')).toHaveTextContent('80');
          });
          await waitFor(() => {
            expect(scrollIntoView.mock.contexts).toEqual([selectedItem]);
          });
          expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
        },
      );

      it('restores the highlight when clearing with the input outside the popup', async () => {
        const { user } = render(() => (
          <Combobox.Root
            items={['apple', 'banana', 'cherry']}
            multiple
            defaultValue={['apple', 'banana']}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.click(input);
        await user.type(input, 'banana');
        await waitFor(() => expect(screen.queryByRole('option', { name: 'apple' })).toBe(null));

        // Opening already highlights the first selected item in this layout, so clearing
        // the query returns to the same anchor.
        await user.clear(input);
        const apple = await screen.findByRole('option', { name: 'apple' });
        await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));
        expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      });

      it('resets selectedIndex when clearing all selections while open', async () => {
        const items = ['apple', 'banana', 'cherry'];

        function App() {
          const [value, setValue] = createSignal(items.slice(0, 2));

          return (
            <Combobox.Root items={items} multiple value={value()} onValueChange={setValue}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="clear" onClick={() => setValue([])}>
                Clear
              </button>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = render(() => <App />);

        expect(screen.queryByRole('listbox')).toBe(null);

        await user.click(screen.getByTestId('input'));

        expect(await screen.findByRole('listbox')).not.toBe(null);
        expect(screen.getByTestId('selected-index').textContent).toBe('0');

        await user.click(screen.getByTestId('clear'));

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });
      });

      it('re-syncs selectedIndex after an external controlled update when closing', async () => {
        const items = ['apple', 'banana', 'cherry'];

        function App() {
          const [value, setValue] = createSignal([items[0]]);

          return (
            <Combobox.Root items={items} multiple value={value()} onValueChange={setValue}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="set-external" onClick={() => setValue([items[2]])}>
                Set external
              </button>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = render(() => <App />);

        const input = screen.getByTestId('input');
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.to.equal(null);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).to.equal('0');
        });

        await user.click(screen.getByTestId('set-external'));
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).to.equal(null);
          expect(screen.getByTestId('selected-index').textContent).to.equal('2');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.to.equal(null);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).to.equal('2');
        });
      });

      it('clears selectedIndex when all values are removed externally while closed (no items prop)', async () => {
        const items = ['apple', 'banana', 'cherry'];

        function App() {
          const [value, setValue] = createSignal(items.slice(0, 2));

          return (
            <Combobox.Root multiple value={value()} onValueChange={setValue}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="external-clear" onClick={() => setValue([])}>
                Clear
              </button>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {items.map((item) => (
                        <Combobox.Item value={item}>{item}</Combobox.Item>
                      ))}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = render(() => <App />);

        const input = screen.getByTestId('input');

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        await user.click(screen.getByTestId('external-clear'));
        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
          'data-highlighted',
        );
      });

      it('should create multiple hidden inputs for form submission', async () => {
        const items = ['a', 'b', 'c'];
        render(() => (
          <Combobox.Root multiple value={items} name="languages">
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        items.forEach((item) => {
          const input = screen.getByDisplayValue(item);
          expect(input).to.have.attribute('type', 'hidden');
          expect(input.tagName).to.equal('INPUT');
        });
      });

      it('does not submit multiple values when disabled', async () => {
        render(() => (
          <form data-testid="form">
            <Combobox.Root multiple disabled name="x" defaultValue={['a']}>
              <Combobox.Input />
            </Combobox.Root>
          </form>
        ));

        const form = screen.getByTestId<HTMLFormElement>('form');

        expect(new FormData(form).getAll('x')).toEqual([]);
      });

      it('should handle disabled state with chips', async () => {
        const { user } = render(() => (
          <Combobox.Root multiple disabled defaultValue={['a', 'b']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-a">
                <Combobox.ChipRemove data-testid="remove-a" />
              </Combobox.Chip>
              <Combobox.Chip data-testid="chip-b">
                <Combobox.ChipRemove data-testid="remove-b" />
              </Combobox.Chip>
            </Combobox.Chips>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                    <Combobox.Item value="c">c</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const chipA = screen.getByTestId('chip-a');
        const removeA = screen.getByTestId('remove-a');

        expect(chipA).to.have.attribute('aria-disabled', 'true');
        expect(removeA).to.have.attribute('aria-disabled', 'true');

        await user.click(removeA);
        expect(screen.getByTestId('chip-a')).not.to.equal(null);
      });

      it('should handle readOnly state with chips', async () => {
        const { user } = render(() => (
          <Combobox.Root multiple readOnly defaultValue={['a', 'b']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-a">
                <Combobox.ChipRemove data-testid="remove-a" />
              </Combobox.Chip>
              <Combobox.Chip data-testid="chip-b">
                <Combobox.ChipRemove data-testid="remove-b" />
              </Combobox.Chip>
            </Combobox.Chips>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                    <Combobox.Item value="c">c</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const chipA = screen.getByTestId('chip-a');
        const removeA = screen.getByTestId('remove-a');

        expect(chipA).to.have.attribute('aria-readonly', 'true');

        await user.click(removeA);
        expect(screen.getByTestId('chip-a')).not.to.equal(null);
      });
    });
  });

  describe('keyboard interaction', () => {
    it('focuses first item on ArrowDown and last item on ArrowUp', async () => {
      const { user } = render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      input.focus();

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const first = screen.getByRole('option', { name: 'apple' });
        expect(input).to.have.attribute('aria-activedescendant', first.id);
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).to.equal(null);
      });

      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        const last = screen.getByRole('option', { name: 'cherry' });
        expect(input).to.have.attribute('aria-activedescendant', last.id);
      });
    });

    it('opens, navigates with ArrowDown, and Enter selects', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = render(() => (
        <Combobox.Root items={items}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      // Highlight first item and select it
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(screen.queryByRole('listbox')).to.equal(null);
      expect(input).to.have.value('apple');
    });

    it('Enter selects with manual indices provided to items', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = render(() => (
        <Combobox.Root items={items}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string, index) => (
                    <Combobox.Item value={item} index={index()}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.to.equal(null);
      });

      await user.type(input, 'c'); // filter to "cherry"
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).to.have.value('cherry');
      });
    });

    it('clicking on "listbox" keeps the focus on the input', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = render(() => (
        <Combobox.Root items={items}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.to.equal(null);
      });

      const listbox = screen.getByRole('listbox');
      await user.click(listbox);
      expect(input).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).to.have.value('apple');
      });
    });

    it('Escape closes the popup without committing when nothing highlighted', async () => {
      const { user } = render(() => (
        <Combobox.Root defaultOpen items={['a', 'b']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      expect(screen.queryByRole('listbox')).not.to.equal(null);

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).to.equal(null);
      expect(input).to.have.value('');
    });

    it('bubbles Escape key when rendered inline without Positioner/Popup', async () => {
      const onOuterKeyDown = spy();

      const { user } = render(() => (
        <div
          data-testid="outer"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root inline defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.List>
              <Combobox.Item value="a">a</Combobox.Item>
              <Combobox.Item value="b">b</Combobox.Item>
            </Combobox.List>
          </Combobox.Root>
        </div>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.to.equal(null);
      });

      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.callCount).to.equal(1);
    });

    it('keeps input value on Enter when inline and no item is highlighted', async () => {
      const { user } = render(() => (
        <Combobox.Root inline items={['Apple', 'Banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.click(input);
      await user.type(input, 'Ba');

      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(input).toHaveValue('Ba');

      await user.keyboard('{Enter}');

      expect(input).toHaveValue('Ba');
    });

    it('bubbles Escape key when list is empty and popup hidden with CSS', async () => {
      const onOuterKeyDown = spy();

      const { user } = render(() => (
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root defaultOpen items={[]}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>
      ));

      const positioner = await screen.findByTestId('positioner');
      positioner.style.display = 'none';

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.callCount).to.equal(1);
    });

    it('does not bubble Escape key when Empty component is present', async () => {
      const onOuterKeyDown = spy();

      const { user } = render(() => (
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root defaultOpen items={[]}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                  <Combobox.Empty>No results.</Combobox.Empty>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>
      ));

      const positioner = await screen.findByTestId('positioner');
      positioner.style.display = 'none';

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.callCount).to.equal(0);
    });
  });

  describe('aria attributes', () => {
    it('sets all aria attributes on the input when closed', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).to.attribute('role', 'combobox');
      expect(input).to.have.attribute('aria-expanded', 'false');
      expect(input).to.have.attribute('aria-autocomplete', 'list');
      expect(input).to.have.attribute('aria-haspopup', 'listbox');
      expect(input).not.to.have.attribute('aria-controls');
      expect(input).not.to.have.attribute('aria-activedescendant');
    });

    it('sets all aria attributes on the input when open', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      expect(input).to.have.attribute('role', 'combobox');
      expect(input).to.have.attribute('aria-expanded', 'true');
      expect(input).to.have.attribute('aria-autocomplete', 'list');
      expect(input).to.have.attribute('aria-haspopup', 'listbox');
      expect(input).to.have.attribute('aria-controls', listbox.id);
      expect(input).not.to.have.attribute('aria-activedescendant');
    });

    it('sets aria-expanded on the input when rendered inline and open', async () => {
      render(() => (
        <Combobox.Root inline open>
          <Combobox.Input data-testid="input" />
          <Combobox.List />
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
    });

    it('sets the popup type on the input when rendered inline as a grid', async () => {
      render(() => (
        <Combobox.Root inline open grid>
          <Combobox.Input data-testid="input" />
          <Combobox.List />
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const grid = screen.getByRole('grid');

      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-haspopup', 'grid');
      expect(input).toHaveAttribute('aria-controls', grid.id);
    });

    it('keeps the input expanded when rendered inline without the `open` prop', async () => {
      const { user } = render(() => (
        <Combobox.Root inline items={['apple', 'banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      // The list renders regardless of the internal open state, so the input must not claim
      // to be collapsed before it's interacted with.
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);

      await user.click(input);

      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
    });

    it('sets correct attributes on the item when highlighted', async () => {
      const { user } = render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');

      await user.click(input);

      expect(input).not.to.have.attribute('aria-activedescendant');

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).to.have.attribute(
          'aria-selected',
          'false',
        );
      });
      expect(screen.getByRole('option', { name: 'b' })).to.have.attribute('aria-selected', 'false');
      expect(input).to.have.attribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: 'a' }).id,
      );

      await user.keyboard('{Enter}');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).to.have.attribute(
          'aria-selected',
          'true',
        );
      });
      expect(screen.getByRole('option', { name: 'b' })).to.have.attribute('aria-selected', 'false');
    });

    it('sets aria-controls to the dialog popup on trigger', async () => {
      const { user } = render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('points aria-controls at a custom popup id on the trigger', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup id="custom-popup-id">
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).toBe('custom-popup-id');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-popup-id');
    });

    it('points aria-controls at a popup id supplied through the render prop', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup render={(props) => <div {...props} id="custom-render-id" />}>
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).toBe('custom-render-id');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-render-id');
    });
  });

  it('should handle browser autofill', async () => {
    const onInputValueChange = spy();
    const { user } = render(() => (
      <Combobox.Root name="test" onInputValueChange={onInputValueChange}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    fireEvent.input(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { target: { value: 'b' } },
    );
    await flushMicrotasks();
    expect(onInputValueChange.lastCall.args[0]).to.equal('b');
    expect(onInputValueChange.lastCall.args[1].reason).to.equal(REASONS.none);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).to.have.attribute('aria-selected', 'true');
    });
  });

  it.each([
    { lockState: 'readOnly', label: 'inside Field', withField: true },
    { lockState: 'disabled', label: 'inside Field', withField: true },
    { lockState: 'readOnly', label: 'outside Field', withField: false },
    { lockState: 'disabled', label: 'outside Field', withField: false },
  ] as const)(
    'ignores hidden-input autofill when $lockState $label',
    async ({ lockState, withField }) => {
      const onValueChange = vi.fn();
      const onInputValueChange = vi.fn();
      // Solid: JSX is created eagerly, so the combobox is built lazily inside the field.
      const combobox = () => (
        <Combobox.Root
          name={withField ? undefined : 'test'}
          readOnly={lockState === 'readOnly'}
          disabled={lockState === 'disabled'}
          onValueChange={onValueChange}
          onInputValueChange={onInputValueChange}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );

      render(() =>
        withField ? (
          <Form errors={{ test: 'test' }}>
            <Field.Root name="test">
              {combobox()}
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ) : (
          combobox()
        ),
      );

      const visibleInput = screen.getByTestId<HTMLInputElement>('input');
      const hiddenInput = screen
        .getAllByDisplayValue('')
        .find((el) => el.getAttribute('name') === 'test') as HTMLInputElement;
      expect(hiddenInput).not.toBeUndefined();

      // Only the Field wrapper renders an error.
      const expectedError = withField ? 'test' : undefined;

      expect(screen.queryByTestId('error')?.textContent).toBe(expectedError);

      fireEvent.input(hiddenInput, { target: { value: 'b' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onInputValueChange).not.toHaveBeenCalled();
      expect(visibleInput.value).toBe('');
      // Solid: delegated handlers skip disabled controls (as browsers do not dispatch input to
      // them), so jsdom's direct write to a disabled hidden input is not reverted.
      if (lockState !== 'disabled') {
        expect(hiddenInput.value).toBe('');
      }

      expect(screen.queryByTestId('error')?.textContent).toBe(expectedError);
    },
  );

  it('shows all items when opening after browser autofill', async () => {
    const items = ['a', 'b', 'c'];
    const { user } = render(() => (
      <Combobox.Root name="test" items={items}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    fireEvent.input(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { target: { value: 'b' } },
    );
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.to.equal(null);
    });
    expect(screen.getByRole('option', { name: 'a' })).not.to.equal(null);
    expect(screen.getByRole('option', { name: 'b' })).not.to.equal(null);
    expect(screen.getByRole('option', { name: 'c' })).not.to.equal(null);
  });

  it('shows all items when opening after browser autofill with insertReplacementText', async () => {
    const items = ['a', 'b', 'c'];
    const { user } = render(() => (
      <Combobox.Root name="test" items={items}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    fireEvent.input(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { inputType: 'insertReplacementText', target: { value: 'b' } },
    );
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.to.equal(null);
    });
    expect(screen.getByRole('option', { name: 'a' })).not.to.equal(null);
    expect(screen.getByRole('option', { name: 'b' })).not.to.equal(null);
    expect(screen.getByRole('option', { name: 'c' })).not.to.equal(null);
  });

  it('should handle browser autofill with object values', async () => {
    const items = [
      { code: 'US', country: 'United States' },
      { code: 'CA', country: 'Canada' },
    ];

    render(() => (
      <Combobox.Root
        name="country"
        items={items}
        itemToStringLabel={(item: (typeof items)[number]) => item.country}
        itemToStringValue={(item: (typeof items)[number]) => item.code}
        defaultOpen
      >
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: (typeof items)[1]) => (
                  <Combobox.Item value={item}>{item.country}</Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    fireEvent.input(
      // getByRole('textbox', { hidden: true, name: 'country' }) does not work
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'country')!,
      { target: { value: 'CA' } },
    );
    await flushMicrotasks();

    fireEvent.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).to.have.attribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('should handle browser autofill with object values when autofill uses the label', async () => {
    // Browsers autofill with the displayed text (label), not the underlying value.
    // For example, Chrome will autofill "United States" (the label), not "US" (the value).
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    const onValueChange = vi.fn();

    render(() => (
      <Combobox.Root
        name="country"
        items={items}
        itemToStringLabel={(item: (typeof items)[number]) => item.country}
        itemToStringValue={(item: (typeof items)[number]) => item.code}
        onValueChange={onValueChange}
        defaultOpen
      >
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: (typeof items)[1]) => (
                  <Combobox.Item value={item}>{item.country}</Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');

    // Simulate browser autofill with the LABEL (displayed text), not the value
    fireEvent.input(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'country')!,
      { target: { value: 'Canada' } }, // Browser sends "Canada" (label), not "CA" (value)
    );
    await flushMicrotasks();

    // onValueChange should be called with the matching object
    expect(onValueChange).toHaveBeenCalledWith(
      { country: 'Canada', code: 'CA' },
      expect.objectContaining({ reason: REASONS.none }),
    );

    fireEvent.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill against an item rendered label for primitive values regardless of case', async () => {
    const { user } = render(() => (
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">United States</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    // The browser autofills the rendered text ("Canada"), not the value ("CA").
    fireEvent.input(hiddenInput, { target: { value: 'canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill by serialized value before an earlier rendered label', async () => {
    const { user } = render(() => (
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="CA">US</Combobox.Item>
                <Combobox.Item value="US">United States</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.input(hiddenInput, { target: { value: 'US' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'United States' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(screen.getByRole('option', { name: 'US' })).toHaveAttribute('aria-selected', 'false');
  });

  it('matches browser autofill when an earlier item has no rendered label', async () => {
    const { user } = render(() => (
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">{null}</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.input(hiddenInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill against an item rendered label when using the items prop', async () => {
    const countryNames: Record<string, string> = {
      US: 'United States',
      CA: 'Canada',
    };

    const { user } = render(() => (
      <Combobox.Root name="country" items={['US', 'CA']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(code: string) => <Combobox.Item value={code}>{countryNames[code]}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.input(hiddenInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('does not force-mount the list when autofill matches a serialized value with the items prop', async () => {
    const { user } = render(() => (
      <Combobox.Root name="country" items={['US', 'CA']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(code: string) => <Combobox.Item value={code}>{code}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.input(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The serialized value matched directly, so the popup must not be force-mounted.
    expect(document.querySelector('[role="listbox"]')).toBe(null);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'CA' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('marks the field dirty and validates after successful autofill', async () => {
    const validateSpy = vi.fn((value: unknown) => {
      return value === 'CA' ? null : 'error';
    });

    render(() => (
      <Field.Root validationMode="onChange" validate={validateSpy}>
        <Combobox.Root name="country">
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="US">United States</Combobox.Item>
                  <Combobox.Item value="CA">Canada</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>
    ));

    const input = screen.getByTestId('input');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(input).not.toHaveAttribute('data-dirty');

    fireEvent.input(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalled();
    });

    expect(validateSpy.mock.calls[validateSpy.mock.calls.length - 1][0]).toBe('CA');
    expect(input).toHaveAttribute('data-dirty', '');
  });

  it('does not update field state when autofill is canceled', async () => {
    render(() => (
      <Form errors={{ country: 'server error' }}>
        <Field.Root name="country">
          <Combobox.Root
            onValueChange={(_value, eventDetails) => {
              eventDetails.cancel();
            }}
          >
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.List>
                    <Combobox.Item value="US">United States</Combobox.Item>
                    <Combobox.Item value="CA">Canada</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      </Form>
    ));

    const trigger = screen.getByTestId('trigger');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');

    fireEvent.input(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The change was canceled, so the value never changed and the field keeps its state.
    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');
  });

  it('does not mark the field dirty when input autofill is canceled', async () => {
    render(() => (
      <Field.Root>
        <Combobox.Root
          name="country"
          onValueChange={(_value, eventDetails) => {
            eventDetails.cancel();
          }}
        >
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="US">United States</Combobox.Item>
                  <Combobox.Item value="CA">Canada</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(trigger).not.toHaveAttribute('data-dirty');

    fireEvent.input(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The change was canceled, so the value never changed and the field stays pristine.
    expect(trigger).not.toHaveAttribute('data-dirty');
  });

  it('should pass autoComplete to the hidden input', async () => {
    render(() => (
      <Combobox.Root name="country" autoComplete="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">United States</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    const hiddenInput = screen.getByRole('textbox', { hidden: true });

    expect(input).to.have.attribute('autocomplete', 'off');
    expect(input).not.to.have.attribute('name');
    expect(hiddenInput).to.have.attribute('name', 'country');
    expect(hiddenInput).not.to.have.attribute('id');
    expect(hiddenInput).to.have.attribute('autocomplete', 'country');
  });

  describe.skipIf(isJSDOM)('scroll locking', () => {
    describe('touch scroll lock', () => {
      it('applies scroll lock when a touch-opened popup covers the viewport width', async () => {
        render(() => (
          <Combobox.Root modal items={['Apple']}>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="Apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const trigger = screen.getByTestId('trigger');

        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.mouseDown(trigger);

        await screen.findByRole('listbox');

        await waitFor(() => {
          const isScrollLocked =
            trigger.ownerDocument.documentElement.style.overflow === 'hidden' ||
            trigger.ownerDocument.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            trigger.ownerDocument.body.style.overflow === 'hidden';

          expect(isScrollLocked).toBe(true);
        });
      });

      it('does not apply scroll lock when a touch-opened popup is narrower than the viewport', async () => {
        render(() => (
          <Combobox.Root modal items={['Apple']}>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner" style={{ width: '240px' }}>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="Apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const trigger = screen.getByTestId('trigger');

        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.mouseDown(trigger);

        await screen.findByRole('listbox');

        await act(async () => {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });
        });

        const isScrollLocked =
          trigger.ownerDocument.documentElement.style.overflow === 'hidden' ||
          trigger.ownerDocument.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
          trigger.ownerDocument.body.style.overflow === 'hidden';

        expect(isScrollLocked).toBe(false);
      });
    });
  });

  it('does not open on programmatic input events', async () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="Darlinghurst">Darlinghurst</Combobox.Item>
                <Combobox.Item value="Sydney">Sydney</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    fireEvent.input(input, { target: { value: 'Darlinghurst' } });
    await flushMicrotasks();

    expect(screen.queryByRole('listbox')).to.equal(null);
  });

  it('opens on paste input events', async () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="Darlinghurst">Darlinghurst</Combobox.Item>
                <Combobox.Item value="Sydney">Sydney</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const input = screen.getByRole('combobox');
    fireEvent.input(input, {
      inputType: 'insertFromPaste',
      target: { value: 'Darlinghurst' },
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.to.equal(null);
    });
  });

  describe('prop: id', () => {
    it('sets the id on the input when it is outside the popup', async () => {
      render(() => (
        <Combobox.Root id="test-id">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await waitFor(() => {
        expect(input).to.have.attribute('id', 'test-id');
      });
    });

    it('sets the id on the trigger when the input is inside the popup', async () => {
      render(() => (
        <Combobox.Root id="test-id" defaultOpen>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const input = screen.getByTestId('input');

      expect(trigger).to.have.attribute('id', 'test-id');
      expect(input).to.not.have.attribute('id', 'test-id');
    });
  });

  describe('prop: disabled', () => {
    it('should render disabled state on all interactive components', async () => {
      const { user } = render(() => (
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a" data-testid="item-a">
                    a
                  </Combobox.Item>
                  <Combobox.Item value="b" data-testid="item-b">
                    b
                  </Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).to.have.attribute('disabled');
      expect(trigger).to.have.attribute('disabled');

      // Verify interactions are disabled
      await user.click(trigger);
      expect(screen.queryByRole('listbox')).to.equal(null);
    });

    it('should not open popup when disabled', async () => {
      const { user } = render(() => (
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      await user.click(input);
      expect(screen.queryByRole('listbox')).to.equal(null);

      await user.click(trigger);
      expect(screen.queryByRole('listbox')).to.equal(null);
    });

    it('should prevent keyboard interactions when disabled', async () => {
      const { user } = render(() => (
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.type(input, 'a');
      expect(screen.queryByRole('listbox')).to.equal(null);
    });

    it('should set disabled attribute on hidden input', async () => {
      render(() => (
        <Combobox.Root disabled name="test">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).to.have.attribute('disabled');
    });
  });

  describe('prop: required', () => {
    it('does not mark the hidden input as required when selection exists in multiple mode', async () => {
      render(() => (
        <Combobox.Root multiple required name="languages" value={['a']}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.to.equal(null);
      expect(hiddenInput).not.to.have.attribute('required');
    });

    it('keeps the hidden input required when no selection exists in multiple mode', async () => {
      render(() => (
        <Combobox.Root multiple required name="languages" value={[]}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.to.equal(null);
      expect(hiddenInput).to.have.attribute('required');
    });
  });

  describe('prop: readOnly', () => {
    it('should render readOnly state on the input', async () => {
      render(() => (
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('aria-readonly', 'true');
      expect(input).toHaveAttribute('readonly');
    });

    it('should expose aria-autocomplete="none" when readOnly', async () => {
      render(() => (
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>
      ));

      expect(screen.getByTestId('input')).toHaveAttribute('aria-autocomplete', 'none');
    });

    it('should open the popup from the input and the trigger when readOnly', async () => {
      const { user } = render(() => (
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('input'));
      expect(await screen.findByRole('listbox')).toHaveAttribute('aria-readonly', 'true');

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(screen.getByTestId('trigger'));
      expect(await screen.findByRole('listbox')).not.toBe(null);
    });

    it('should browse the items with the arrow keys when readOnly', async () => {
      const { user } = render(() => (
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await screen.findByRole('listbox');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-highlighted');
      });
    });

    it('should not change the input value when typing while readOnly', async () => {
      const onInputValueChange = vi.fn();
      const { user } = render(() => (
        <Combobox.Root readOnly onInputValueChange={onInputValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.type(input, 'a');

      expect(input).toHaveValue('');
      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('should set readOnly attribute on hidden input', async () => {
      render(() => (
        <Combobox.Root readOnly name="test">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('readonly');
    });

    it('should prevent value changes when readOnly with items', async () => {
      const handleValueChange = vi.fn();
      const { user } = render(() => (
        <Combobox.Root readOnly onValueChange={handleValueChange} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a" data-testid="item-a">
                    a
                  </Combobox.Item>
                  <Combobox.Item value="b" data-testid="item-b">
                    b
                  </Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const itemA = screen.getByTestId('item-a');
      await user.click(itemA);

      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('should not submit the form with Enter on a highlighted item when readOnly', async () => {
      const onSubmit = vi.fn();
      const { user } = render(() => (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Combobox.Root readOnly>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <button type="submit">Submit</button>
        </form>
      ));

      await user.click(screen.getByTestId('input'));
      await screen.findByRole('listbox');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{Enter}');

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should report arrow-key highlights as keyboard-driven when readOnly', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = render(() => (
        <Combobox.Root readOnly onItemHighlighted={onItemHighlighted}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // Opening by pointer marks pointer activity, which the arrow key must clear.
      await user.click(screen.getByTestId('input'));
      await screen.findByRole('listbox');
      onItemHighlighted.mockClear();

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenCalledWith(
          'a',
          expect.objectContaining({ reason: 'keyboard' }),
        );
      });
    });

    it('should not commit a value with Enter on a highlighted item when readOnly', async () => {
      const handleValueChange = vi.fn();
      const { user } = render(() => (
        <Combobox.Root readOnly onValueChange={handleValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await screen.findByRole('listbox');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-highlighted');
      });

      await user.keyboard('{Enter}');

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(input).toHaveValue('');
    });
  });

  describe('prop: itemToStringLabel', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringLabel for input value synchronization', async () => {
      const { user } = render(() => (
        <Combobox.Root
          items={items}
          itemToStringLabel={(item: (typeof items)[number]) => item.country}
          itemToStringValue={(item: (typeof items)[number]) => item.code}
          defaultOpen
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: { country: string; code: string }) => (
                    <Combobox.Item value={item}>{item.country}</Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.click(screen.getByText('Canada'));
      expect(input).to.have.value('Canada');
    });

    it('shows the label for a controlled object value not in items', async () => {
      const value = { code: 'JP', country: 'Japan' };

      render(() => (
        <Combobox.Root
          items={items}
          value={value}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Combobox.Input />
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      expect(input).to.have.value('Japan');
    });
  });

  describe('prop: itemToStringValue', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringValue for form submission', async () => {
      render(() => (
        <Combobox.Root
          name="country"
          items={items}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
          defaultValue={items[0]}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const hiddenInput = screen.getByDisplayValue('US'); // input[name="country"]
      expect(hiddenInput.tagName).to.equal('INPUT');
      expect(hiddenInput).to.have.attribute('name', 'country');
    });

    it('uses itemToStringValue for multiple selection form submission', async () => {
      const values = [items[0], items[1]];
      render(() => (
        <Combobox.Root
          name="countries"
          items={items}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
          multiple
          defaultValue={values}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      values.forEach((value) => {
        const input = screen.getByDisplayValue(value.code);
        expect(input.tagName).to.equal('INPUT');
        expect(input).to.have.attribute('name', 'countries');
      });
    });
  });

  describe('initial input value derivation', () => {
    it('derives input from defaultValue on first mount when unspecified', async () => {
      render(() => (
        <Combobox.Root defaultValue="apple">
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).to.have.value('apple');
    });

    it('derives input from defaultValue on first mount with items prop', async () => {
      const items = [{ label: 'Apple', value: 'apple' }];
      render(() => (
        <Combobox.Root items={items} defaultValue={items[0]}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).to.have.value('Apple');
    });

    it('derives input from controlled value on first mount when unspecified', async () => {
      render(() => (
        <Combobox.Root value="banana">
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).to.have.value('banana');
    });

    it('defaultInputValue overrides derivation when provided', async () => {
      render(() => (
        <Combobox.Root defaultValue="apple" defaultInputValue="x">
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).to.have.value('x');
    });

    it('inputValue overrides derivation when provided', async () => {
      render(() => (
        <Combobox.Root value="apple" inputValue="x">
          <Combobox.Input />
        </Combobox.Root>
      ));

      expect(screen.getByRole('combobox')).to.have.value('x');
    });

    it('multiple mode initial input remains empty', async () => {
      const items = [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ];
      render(() => (
        <Combobox.Root multiple items={items}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      const input = screen.getAllByRole('combobox').find((element) => element.tagName === 'INPUT');

      expect(input).to.have.value('');
    });

    it('does not set input value for input-inside-popup pattern', async () => {
      render(() => (
        <Combobox.Root defaultOpen defaultValue="apple">
          <Combobox.Trigger>Trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getAllByRole('combobox').find((element) => element.tagName === 'INPUT');

      expect(input).to.have.value('');
    });
  });

  describe('input value synchronization', () => {
    it('updates derived input when controlled value changes externally', async () => {
      const items = [
        { label: 'Apple', value: 'apple' },
        { label: 'Banana', value: 'banana' },
      ];

      const [value, setValue] = createSignal(items[0]);
      render(() => (
        <Combobox.Root items={items} value={value()}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).to.have.value('Apple');

      act(() => setValue(items[1]));

      expect(input).to.have.value('Banana');
    });

    it.each([false, true])(
      'does not force-mount the list when controlled value changes externally (strict: %s)',
      async (strict) => {
        const items = ['apple', 'banana'];
        const labels: Record<string, string> = {
          apple: 'Apple',
          banana: 'Banana',
        };

        function App() {
          const [withItems, setWithItems] = createSignal<string | null>(null);
          const [withoutItems, setWithoutItems] = createSignal<string | null>(null);

          return (
            <div>
              <button
                type="button"
                onClick={() => {
                  setWithItems('banana');
                  setWithoutItems('banana');
                }}
              >
                Set
              </button>
              <Combobox.Root
                items={items}
                value={withItems()}
                onValueChange={setWithItems}
                itemToStringLabel={(item) => labels[item]}
              >
                <Combobox.Input data-testid="items-input" />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        {(item: string) => (
                          <Combobox.Item value={item}>{labels[item]}</Combobox.Item>
                        )}
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
              <Combobox.Root
                value={withoutItems()}
                onValueChange={setWithoutItems}
                itemToStringLabel={(item) => labels[item]}
              >
                <Combobox.Input data-testid="plain-input" />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup>
                      <Combobox.List>
                        <Combobox.Item value="apple">Apple</Combobox.Item>
                        <Combobox.Item value="banana">Banana</Combobox.Item>
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            </div>
          );
        }

        // Solid: there is no Strict Mode double render, so both cases render the same tree.
        const { user } = render(() => <App />);

        expect(screen.queryAllByRole('listbox', { hidden: true })).toHaveLength(0);

        await user.click(screen.getByRole('button', { name: 'Set' }));

        expect(screen.queryAllByRole('listbox', { hidden: true })).toHaveLength(0);
        expect(screen.getByTestId('items-input')).toHaveValue('Banana');
        expect(screen.getByTestId('plain-input')).toHaveValue('Banana');
      },
    );

    it('re-derives input when items array changes', async () => {
      const initialItems = [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
      ];

      const [rootProps, setRootProps] = createSignal({
        items: initialItems,
        value: initialItems[0],
      });
      render(() => (
        <Combobox.Root items={rootProps().items} value={rootProps().value}>
          <Combobox.Input />
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      const nextItems = [
        { value: 'a', label: 'Apricot' },
        { value: 'b', label: 'Banana' },
        { value: 'c', label: 'Cherry' },
      ];

      act(() => setRootProps({ items: nextItems, value: nextItems[0] }));
      expect(input).toHaveValue('Apricot');

      const sameLengthDifferentItems = [
        { value: 'a', label: 'Ambrosia' },
        { value: 'b', label: 'Blue Java' },
        { value: 'c', label: 'Clementine' },
      ];

      act(() =>
        setRootProps({ items: sameLengthDifferentItems, value: sameLengthDifferentItems[0] }),
      );
      expect(input).toHaveValue('Ambrosia');
    });

    it('restores the selected label after a one-step clear and items reload', async () => {
      const itemToStringLabel = (item: string) => (item === 'apple' ? 'Apple' : item);
      // Solid: props that the React test changes with `setProps` are held in a signal.
      const [rootProps, setRootProps] = createSignal<Record<string, any>>({ items: ['apple'] });
      const { user } = render(() => (
        <Combobox.Root
          items={rootProps().items}
          value="apple"
          itemToStringLabel={itemToStringLabel}
        >
          <Combobox.Input />
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      await user.clear(input);
      expect(input).toHaveValue('');

      act(() => setRootProps((prev) => ({ ...prev, items: ['apple'] })));

      expect(input).toHaveValue('Apple');
    });

    it('reports a single input value change when the controlled value changes', async () => {
      const onInputValueChange = vi.fn();
      const items = [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
        { value: 'c', label: 'Cherry' },
      ];

      // Solid: props that the React test changes with `setProps` are held in a signal.
      const [rootProps, setRootProps] = createSignal<Record<string, any>>({ value: items[0] });
      render(() => (
        <Combobox.Root
          items={items}
          value={rootProps().value}
          onInputValueChange={onInputValueChange}
        >
          <Combobox.Input />
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');

      act(() => setRootProps((prev) => ({ ...prev, value: items[1] })));

      expect(input).toHaveValue('Banana');
      expect(onInputValueChange).toHaveBeenCalledTimes(1);

      act(() => setRootProps((prev) => ({ ...prev, value: items[2] })));

      expect(input).toHaveValue('Cherry');
      expect(onInputValueChange).toHaveBeenCalledTimes(2);

      act(() => setRootProps((prev) => ({ ...prev, value: items[0] })));

      expect(input).toHaveValue('Apple');
      expect(onInputValueChange).toHaveBeenCalledTimes(3);
    });

    it('syncs again after a canceled sync to the same label', async () => {
      let cancelSync = false;

      function App(props: { value: string }) {
        return (
          <Combobox.Root
            items={['One', 'Two']}
            value={props.value}
            onInputValueChange={(_, eventDetails) => {
              if (cancelSync && eventDetails.reason === 'none') {
                eventDetails.cancel();
              }
            }}
          >
            <Combobox.Input />
          </Combobox.Root>
        );
      }

      // Solid: props that the React test changes with `setProps` are held in a signal.
      const [rootProps, setRootProps] = createSignal<Record<string, any>>({ value: 'One' });
      render(() => <App value={rootProps().value} />);
      const input = screen.getByRole<HTMLInputElement>('combobox');

      expect(input).toHaveValue('One');

      cancelSync = true;
      act(() => setRootProps((prev) => ({ ...prev, value: 'Two' })));

      expect(input).toHaveValue('One');

      // The input already matches this label, so nothing is written and nothing observes a change.
      cancelSync = false;
      act(() => setRootProps((prev) => ({ ...prev, value: 'One' })));

      expect(input).toHaveValue('One');

      act(() => setRootProps((prev) => ({ ...prev, value: 'Two' })));

      expect(input).toHaveValue('Two');
    });

    it('reports a single input value change when the selection is remapped', async () => {
      const onInputValueChange = vi.fn();

      function App() {
        const [value, setValue] = createSignal('Apple');
        return (
          <Combobox.Root
            items={['Apple', 'Banana', 'Cherry']}
            value={value()}
            onValueChange={(next) => setValue(next === 'Banana' ? 'Cherry' : (next ?? ''))}
            onInputValueChange={onInputValueChange}
            defaultOpen
          >
            <Combobox.Input />
            <Combobox.List>
              {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Root>
        );
      }

      const { user } = render(() => <App />);

      await user.click(screen.getByRole('option', { name: 'Banana' }));

      expect(screen.getByRole<HTMLInputElement>('combobox')).toHaveValue('Cherry');
      expect(
        onInputValueChange.mock.calls.map(([next, details]) => [next, details.reason]),
      ).toEqual([
        ['Banana', 'item-press'],
        ['Cherry', 'none'],
      ]);
    });

    it('re-syncs the input when the resolved label of an unchanged value changes', async () => {
      function App(props: { itemToStringLabel: (value: string) => string }) {
        return (
          <Combobox.Root items={['a', 'b']} value="b" itemToStringLabel={props.itemToStringLabel}>
            <Combobox.Input />
          </Combobox.Root>
        );
      }

      // Solid: props that the React test changes with `setProps` are held in a signal.
      const [rootProps, setRootProps] = createSignal<Record<string, any>>({
        itemToStringLabel: (value) => value,
      });
      render(() => <App itemToStringLabel={rootProps().itemToStringLabel} />);
      const input = screen.getByRole<HTMLInputElement>('combobox');

      expect(input).toHaveValue('b');

      act(() =>
        setRootProps((prev) => ({
          ...prev,
          itemToStringLabel: (value: string) => (value === 'b' ? 'Banana' : value),
        })),
      );

      expect(input).toHaveValue('Banana');
    });

    it('restores derived input after items load asynchronously', async () => {
      const [items, setItems] = createSignal<string[]>([]);
      render(() => (
        <Combobox.Root items={items()} value="banana">
          <Combobox.Input />
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).to.have.value('banana');

      act(() => setItems(['apple', 'banana', 'bread']));

      expect(input).to.have.value('banana');

      act(() => setItems(['banana']));

      expect(input).to.have.value('banana');
    });
  });

  describe.skipIf(isJSDOM)('reopening during the close animation', () => {
    const closeAnimationStyle = `
      @keyframes combobox-close-test {
        to {
          opacity: 0;
        }
      }

      .animation-test-popup[data-ending-style] {
        animation: combobox-close-test 400ms linear;
      }
    `;

    it('shows every item when a controlled reopen interrupts a canceled mirrored-selection clear', async ({
      onTestFinished,
    }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      });

      function App() {
        const [open, setOpen] = createSignal(false);
        const [inputValue, setInputValue] = createSignal('');

        return (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={closeAnimationStyle} />
            <button type="button" data-testid="open" onClick={() => setOpen(true)}>
              Open
            </button>
            <Combobox.Root
              items={['apple', 'apricot', 'banana']}
              open={open()}
              onOpenChange={setOpen}
              onValueChange={(value: string | null) => setInputValue(value ?? '')}
              inputValue={inputValue()}
              onInputValueChange={(value, eventDetails) => {
                if (eventDetails.reason === REASONS.inputClear) {
                  eventDetails.cancel();
                } else {
                  setInputValue(value);
                }
              }}
            >
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      }

      const { user } = render(() => <App />);

      await user.click(screen.getByTestId('open'));
      const input = await screen.findByTestId('input');
      await user.type(input, 'ap');
      await user.click(await screen.findByRole('option', { name: 'apple' }));

      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

      await user.click(screen.getByTestId('open'));
      await waitFor(() => expect(popup).not.toHaveAttribute('data-ending-style'));

      expect(input).toHaveValue('apple');
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    });

    it('keeps the typed filter when items change afterwards (input outside popup)', async ({
      onTestFinished,
    }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      });

      function App() {
        const [items, setItems] = createSignal(['apple', 'apricot', 'banana']);
        return (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={closeAnimationStyle} />
            <button
              type="button"
              data-testid="refetch"
              onClick={() => setItems((prev) => [...prev])}
            >
              refetch
            </button>
            <Combobox.Root items={items()}>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      }

      const { user } = render(() => <App />);

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.keyboard('{Escape}');

      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

      await user.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      expect(input).toHaveValue('app');

      // A new `items` identity must not resync the input to the selected label while the
      // user's filter is still in it.
      await user.click(screen.getByTestId('refetch'));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
    });

    it('keeps filtering when typing reopens the popup (input outside popup)', async ({
      onTestFinished,
    }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      });

      const { user } = render(() => (
        <>
          {/* eslint-disable-next-line react/no-danger */}
          <style innerHTML={closeAnimationStyle} />
          <Combobox.Root items={['apple', 'apricot', 'banana']} defaultValue="apple">
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="popup" class="animation-test-popup">
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </>
      ));

      const input = screen.getByTestId('input');
      expect(input).toHaveValue('apple');

      await user.click(input);
      await user.keyboard('{Backspace}');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(1));

      await user.keyboard('{Escape}');

      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

      // Typing reopens the popup, so the keystroke's own "query changed" flag must survive
      // the reopen even when it restores the selected label exactly.
      await user.keyboard('e');
      await flushMicrotasks();

      expect(input).toHaveValue('apple');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(1));
    });

    it('does not re-emit a clear when closing again without typing (multiple, input outside popup)', async ({
      onTestFinished,
    }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      });

      const onInputValueChange = vi.fn();

      const { user } = render(() => (
        <>
          {/* eslint-disable-next-line react/no-danger */}
          <style innerHTML={closeAnimationStyle} />
          <Combobox.Root
            multiple
            items={['apple', 'apricot', 'banana']}
            onInputValueChange={onInputValueChange}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="popup" class="animation-test-popup">
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.keyboard('{Escape}');

      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

      // The close path already cleared the input, so nothing survives the reopen.
      await user.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      expect(input).toHaveValue('');

      onInputValueChange.mockClear();

      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('keeps a keystroke typed into an empty input when items refresh synchronously', async ({
      onTestFinished,
    }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      });

      function App() {
        const [items, setItems] = createSignal(['apple', 'apricot', 'banana']);
        return (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={closeAnimationStyle} />
            <Combobox.Root
              items={items()}
              defaultValue="apple"
              onInputValueChange={() => {
                setItems((prev) => [...prev]);
              }}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      }

      const { user } = render(() => <App />);

      const input = screen.getByTestId('input');
      expect(input).toHaveValue('apple');

      await user.click(input);
      await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
      expect(input).toHaveValue('');

      await user.keyboard('{Escape}');

      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

      // `ComboboxInput` sets the input value before requesting the open, so the reopen must not
      // judge survival from the stale empty value and let the `items` sync undo the keystroke.
      await user.keyboard('a');
      await flushMicrotasks();

      expect(input).toHaveValue('a');
    });

    it('releases the frozen query when controlled open reopens the popup', async ({
      onTestFinished,
    }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const onInputValueChange = vi.fn();

      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      });

      function App() {
        const [open, setOpen] = createSignal(false);

        return (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={closeAnimationStyle} />
            <button type="button" data-testid="reopen" onClick={() => setOpen(true)}>
              Reopen
            </button>
            <Combobox.Root
              multiple
              items={['apple', 'apricot', 'banana']}
              open={open()}
              onOpenChange={setOpen}
              onInputValueChange={onInputValueChange}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      }

      const { user } = render(() => <App />);
      const input = screen.getByTestId('input');

      await user.type(input, 'app');
      await user.keyboard('{Escape}');

      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

      await user.click(screen.getByTestId('reopen'));

      await waitFor(() => expect(input).toHaveValue(''));
      expect(await screen.findByRole('option', { name: 'banana' })).not.toBe(null);

      onInputValueChange.mockClear();
      await user.keyboard('{Escape}');

      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('unfreezes filtering when a controlled open ignores the close request (multiple, input outside popup)', async () => {
      const { user } = render(() => (
        <Combobox.Root multiple items={['apple', 'apricot', 'banana']} open onOpenChange={() => {}}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup">
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'ap');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(2));

      // The close request clears the input and freezes the query for the exit animation,
      // but the consumer keeps the popup open, so the frozen query must stop filtering.
      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(input).toHaveValue('');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(3));
    });

    it('opens blank when the input only mirrors the selection (single, input inside popup)', async ({
      onTestFinished,
    }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      });

      function App() {
        const [value, setValue] = createSignal<string | null>(null);
        const [inputValue, setInputValue] = createSignal('');
        return (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={closeAnimationStyle} />
            <Combobox.Root
              items={['apple', 'apricot', 'banana']}
              value={value()}
              onValueChange={(next: string | null) => {
                setValue(next);
                setInputValue(next ?? '');
              }}
              inputValue={inputValue()}
              onInputValueChange={setInputValue}
            >
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      }

      const { user } = render(() => <App />);

      await user.click(screen.getByTestId('trigger'));
      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ap');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(2));

      await user.click(screen.getByRole('option', { name: 'apple' }));

      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

      // A consumer mirroring the selection into the popup input must not leave the reopened
      // list filtered by it: an interrupted close opens blank, same as a completed one.
      await user.click(screen.getByTestId('trigger'));

      const inputAfter = await screen.findByTestId('input');
      await waitFor(() => expect(inputAfter).toHaveValue(''));
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(3));
    });

    it('keeps an input value set in the same batch as a controlled reopen (input inside popup)', async ({
      onTestFinished,
    }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      });

      const onInputValueChange = vi.fn();

      function App() {
        const [open, setOpen] = createSignal(false);
        const [inputValue, setInputValue] = createSignal('');
        return (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={closeAnimationStyle} />
            <button
              type="button"
              data-testid="preset"
              onClick={() => {
                setInputValue('banana');
                setOpen(true);
              }}
            >
              preset
            </button>
            <Combobox.Root
              items={['apple', 'apricot', 'banana']}
              open={open()}
              onOpenChange={setOpen}
              inputValue={inputValue()}
              onInputValueChange={(value, eventDetails) => {
                onInputValueChange(value, eventDetails.reason);
                setInputValue(value);
              }}
            >
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        );
      }

      const { user } = render(() => <App />);

      await user.click(screen.getByTestId('trigger'));
      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'ap');
      await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(2));

      await user.keyboard('{Escape}');
      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

      onInputValueChange.mockClear();

      // The consumer's value never fed the frozen query, so the reopen cleanup must not
      // mistake it for leftover filter text and clear it.
      await user.click(screen.getByTestId('preset'));
      await flushMicrotasks();

      const inputAfter = await screen.findByTestId('input');
      expect(inputAfter).toHaveValue('banana');
      expect(onInputValueChange).not.toHaveBeenCalledWith('', 'input-clear');
    });

    it('shows every item when selection reopens the popup', async ({ onTestFinished }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      onTestFinished(() => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      });

      const { user } = render(() => (
        <>
          {/* eslint-disable-next-line react/no-danger */}
          <style innerHTML={closeAnimationStyle} />
          <Combobox.Root items={['apple', 'apricot', 'banana']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="popup" class="animation-test-popup">
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'ap');
      await user.click(screen.getByRole('option', { name: 'apple' }));

      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

      await user.click(screen.getByTestId('trigger'));

      expect(input).toHaveValue('apple');
      await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    });
  });

  it('does not render aria-orientation on the listbox role', async () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.List>
          <Combobox.Item value="1">1</Combobox.Item>
        </Combobox.List>
      </Combobox.Root>
    ));

    // `listbox` is implicitly vertical.
    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-orientation');
  });

  describe('prop: grid', () => {
    it('sets grid roles when grid is enabled and rows are used', async () => {
      render(() => (
        <Combobox.Root grid defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                    <Combobox.Item value="3">3</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="4">4</Combobox.Item>
                    <Combobox.Item value="5">5</Combobox.Item>
                    <Combobox.Item value="6">6</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const grid = screen.getByRole('grid');
      expect(grid).not.to.equal(null);
      const cells = screen.getAllByRole('gridcell');
      expect(cells).to.have.length(6);
    });

    it('arrow keys navigate across rows and columns in grid mode', async () => {
      const onItemHighlighted = spy();
      const { user } = render(() => (
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                    <Combobox.Item value="3">3</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="4">4</Combobox.Item>
                    <Combobox.Item value="5">5</Combobox.Item>
                    <Combobox.Item value="6">6</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.to.equal(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('3'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('6'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('5'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('2'));
    });

    // https://github.com/mui/base-ui/issues/4947
    it('moves the input caret on ArrowLeft when no item is highlighted in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = render(() => (
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'abc');

      expect(input.value).toBe('abc');
      expect(input.selectionStart).toBe(3);

      await user.keyboard('{ArrowLeft}');

      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });

    // https://github.com/mui/base-ui/issues/4947
    it('moves the input caret on ArrowRight when no item is highlighted in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = render(() => (
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'abc');
      input.setSelectionRange(1, 1);

      expect(input.selectionStart).toBe(1);

      await user.keyboard('{ArrowRight}');

      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });

    // https://github.com/mui/base-ui/issues/4947
    it('keeps grid navigation when autoHighlight surfaces an item before typing arrow keys', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = render(() => (
        <Combobox.Root grid autoHighlight onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'a');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('mirrors horizontal grid navigation in RTL mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = render(() => (
        <DirectionProvider direction="rtl">
          <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Row>
                      <Combobox.Item value="1">1</Combobox.Item>
                      <Combobox.Item value="2">2</Combobox.Item>
                      <Combobox.Item value="3">3</Combobox.Item>
                    </Combobox.Row>
                    <Combobox.Row>
                      <Combobox.Item value="4">4</Combobox.Item>
                      <Combobox.Item value="5">5</Combobox.Item>
                      <Combobox.Item value="6">6</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </DirectionProvider>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('supports uneven rows navigation', async () => {
      const onItemHighlighted = spy();
      const { user } = render(() => (
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                    <Combobox.Item value="3">3</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="4">4</Combobox.Item>
                    <Combobox.Item value="5">5</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="6">6</Combobox.Item>
                    <Combobox.Item value="7">7</Combobox.Item>
                    <Combobox.Item value="8">8</Combobox.Item>
                    <Combobox.Item value="9">9</Combobox.Item>
                    <Combobox.Item value="10">10</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.to.equal(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('3'));

      // Down from last col (3) to shorter row should clamp to last item (5)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('5'));

      // Up from clamped item (5) should return to same column in previous row (2)
      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('2'));

      // From 2, move down to 5 (same column), then down to 7 in the longer row
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('5'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('7'));

      // Left within last row goes to 6, up to first col in previous row (4)
      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('6'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('4'));
    });

    it('supports uneven rows navigation within groups', async () => {
      const onItemHighlighted = spy();
      const { user } = render(() => (
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group>
                    <Combobox.Row>
                      <Combobox.Item value="1">1</Combobox.Item>
                      <Combobox.Item value="2">2</Combobox.Item>
                      <Combobox.Item value="3">3</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                  <Combobox.Group>
                    <Combobox.Row>
                      <Combobox.Item value="4">4</Combobox.Item>
                      <Combobox.Item value="5">5</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                  <Combobox.Group>
                    <Combobox.Row>
                      <Combobox.Item value="6">6</Combobox.Item>
                      <Combobox.Item value="7">7</Combobox.Item>
                      <Combobox.Item value="8">8</Combobox.Item>
                      <Combobox.Item value="9">9</Combobox.Item>
                      <Combobox.Item value="10">10</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.to.equal(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('3'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('5'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('2'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('5'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.lastCall.args[0]).to.equal('7'));
    });

    it('does not render aria-orientation on the grid role', async () => {
      render(() => (
        <Combobox.Root grid defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // The grid role does not support aria-orientation (axe: aria-allowed-attr).
      const grid = screen.getByRole('grid');
      expect(grid).not.toHaveAttribute('aria-orientation');
    });

    it('renders groups with the rowgroup role', async () => {
      render(() => (
        <Combobox.Root grid defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group>
                    <Combobox.GroupLabel>Fruits</Combobox.GroupLabel>
                    <Combobox.Row>
                      <Combobox.Item value="1">1</Combobox.Item>
                      <Combobox.Item value="2">2</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // `grid` may only own `row`/`rowgroup` elements (axe: aria-required-children),
      // and `row` must be owned by `grid`, `rowgroup`, or `treegrid` (axe: aria-required-parent).
      expect(screen.queryByRole('group')).toBeNull();
      expect(screen.getByRole('rowgroup')).toHaveAccessibleName('Fruits');
    });
  });

  describe('prop: multiple', () => {
    it('"single" selects and closes, then reopens with selection focused', async () => {
      const { user } = render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                  <Combobox.Item value="c">c</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(screen.getByRole('option', { name: 'b' }));
      expect(screen.queryByRole('listbox')).to.equal(null);
      expect(input).to.have.value('b');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));
      expect(screen.getByRole('option', { name: 'b' })).to.have.attribute('aria-selected', 'true');
    });

    it('"single" keeps the popup open when selection is canceled', async () => {
      const onValueChange = vi.fn((value, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });
      const { user } = render(() => (
        <Combobox.Root defaultOpen onValueChange={onValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(screen.getByRole('option', { name: 'b' }));

      // The change was canceled, so the value never committed and the popup stays open.
      expect(onValueChange).toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(input).not.toHaveValue('b');
    });

    it('"multiple" clears uncontrolled input after select when filtering', async () => {
      const { user } = render(() => (
        <Combobox.Root multiple>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await flushMicrotasks();
      await user.click(screen.getByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      // After selecting while filtering, uncontrolled input clears
      expect(input).to.have.value('');
    });

    it('keeps the active item when the post-selection input clear is canceled', async ({
      onTestFinished,
    }) => {
      const items = ['apple', 'apricot', 'banana'];
      const onInputValueChange = vi.fn((_value, details: Combobox.Root.ChangeEventDetails) => {
        if (details.reason === REASONS.inputClear) {
          details.cancel();
        }
      });

      const { user } = render(() => (
        <Combobox.Root multiple defaultOpen items={items} onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      const apple = await screen.findByRole('option', { name: 'apple' });
      fireEvent.mouseMove(apple, { pointerType: 'mouse' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      const ariaMutations: MutationRecord[] = [];
      const observer = new MutationObserver((records) => ariaMutations.push(...records));
      observer.observe(input, {
        attributes: true,
        attributeFilter: ['aria-activedescendant'],
      });
      onTestFinished(() => observer.disconnect());

      fireEvent.click(apple);
      await flushMicrotasks();

      expect(onInputValueChange.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
      expect(input).toHaveValue('app');
      expect(apple).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      expect(ariaMutations).toHaveLength(0);
    });

    it('keeps the filter text when the "item-press" close is canceled (input outside popup)', async () => {
      const { user } = render(() => (
        <Combobox.Root
          multiple
          onOpenChange={(open, eventDetails) => {
            if (!open && eventDetails.reason === REASONS.itemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(input).toHaveValue('');
    });

    it('marks the close-path clear as an item press only when an item press closed the popup (input outside popup)', async () => {
      const onInputValueChange = vi.fn();

      const { user } = render(() => (
        <Combobox.Root multiple onInputValueChange={onInputValueChange}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      onInputValueChange.mockClear();

      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('');
      expect(onInputValueChange.mock.calls.find((call) => call[0] === '')?.[1].isItemPress).toBe(
        true,
      );

      await user.type(input, 'app');
      onInputValueChange.mockClear();

      // Closing with the keyboard clears the same way, but no item was pressed.
      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(input).toHaveValue('');
      expect(onInputValueChange.mock.calls.find((call) => call[0] === '')?.[1].isItemPress).toBe(
        false,
      );
    });

    it('keeps the filter text when the selection clear is canceled (input inside popup)', async () => {
      const { user } = render(() => (
        <Combobox.Root
          multiple
          defaultOpen
          onInputValueChange={(value, eventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    it('keeps the filter text in an inline list when the selection clear is canceled', async () => {
      const { user } = render(() => (
        <Combobox.Root
          multiple
          inline
          open
          onInputValueChange={(value, eventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            <Combobox.Item value="apple">apple</Combobox.Item>
            <Combobox.Item value="apricot">apricot</Combobox.Item>
            <Combobox.Item value="banana">banana</Combobox.Item>
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('still clears the kept filter text once the popup closes', async () => {
      const { user } = render(() => (
        <Combobox.Root
          multiple
          onInputValueChange={(value, eventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          }}
        >
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'app');
      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(input).toHaveValue('app');

      // The cleanup clear that runs after the popup closes doesn't carry `isItemPress`, so the
      // recipe doesn't cancel it and the next open starts with a fresh filter.
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

      await user.click(trigger);

      expect(await screen.findByTestId('input')).toHaveValue('');
    });

    it('clears the input with the "input-clear" reason and the item click event on pointer selection', async () => {
      const onInputValueChange = vi.fn();

      const { user } = render(() => (
        <Combobox.Root multiple defaultOpen onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.type(screen.getByTestId('input'), 'app');
      onInputValueChange.mockClear();

      await user.click(await screen.findByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      expect(onInputValueChange).toHaveBeenCalledWith(
        '',
        expect.objectContaining({ reason: REASONS.inputClear }),
      );
      expect(onInputValueChange.mock.lastCall?.[1].event?.type).toBe('click');
      expect(onInputValueChange.mock.lastCall?.[1].isItemPress).toBe(true);
    });

    it('clears the input with the "input-clear" reason and the originating keydown event on keyboard selection', async () => {
      const onInputValueChange = vi.fn();

      const { user } = render(() => (
        <Combobox.Root multiple defaultOpen onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await screen.findByRole('option', { name: 'apple' });

      await user.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute('data-highlighted'),
      );

      onInputValueChange.mockClear();
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      expect(onInputValueChange).toHaveBeenCalledWith(
        '',
        expect.objectContaining({ reason: REASONS.inputClear }),
      );
      // Keyboard activation synthesizes a click on the highlighted item, but the details carry the
      // originating keydown so consumers see the real user gesture.
      expect(onInputValueChange.mock.lastCall?.[1].event?.type).toBe('keydown');
      expect(onInputValueChange.mock.lastCall?.[1].isItemPress).toBe(true);
    });

    it('keeps the filter text when a drag-select release commits the selection', async () => {
      const onInputValueChange = vi.fn((_value, eventDetails: Combobox.Root.ChangeEventDetails) => {
        if (eventDetails.isItemPress) {
          eventDetails.cancel();
        }
      });

      const { user } = render(() => (
        <Combobox.Root multiple defaultOpen onInputValueChange={onInputValueChange}>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      const apple = await screen.findByRole('option', { name: 'apple' });
      fireEvent.mouseMove(apple, { pointerType: 'mouse' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      // Press starts outside the item (drag-select), so the commit happens on mouseup.
      fireEvent.mouseUp(apple, { button: 0 });
      await flushMicrotasks();

      expect(input).toHaveValue('app');
      expect(apple).toHaveAttribute('aria-selected', 'true');
      expect(onInputValueChange.mock.lastCall?.[1].isItemPress).toBe(true);
    });

    it.skipIf(isJSDOM)(
      'clears the pending filter with the "input-clear" reason when reopening interrupts the close animation',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 1s linear;
          }
        `;

        const onInputValueChange = vi.fn(
          (_value, eventDetails: Combobox.Root.ChangeEventDetails) => {
            if (eventDetails.isItemPress) {
              eventDetails.cancel();
            }
          },
        );

        const { user } = render(() => (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={style} />
            <Combobox.Root
              multiple
              items={['apple', 'apricot', 'banana']}
              onInputValueChange={onInputValueChange}
            >
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        ));

        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        const input = await screen.findByTestId('input');
        await waitFor(() => expect(input).toHaveFocus());

        await user.type(input, 'app');
        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

        const callsBeforeReopen = onInputValueChange.mock.calls.length;
        await user.click(trigger);

        await waitFor(() => expect(screen.getByTestId('input')).toHaveValue(''));

        const cleanupCall = onInputValueChange.mock.calls
          .slice(callsBeforeReopen)
          .find((call) => call[0] === '');
        expect(cleanupCall).not.toBe(undefined);
        expect(cleanupCall?.[1].reason).toBe(REASONS.inputClear);
        expect(cleanupCall?.[1].isItemPress).toBe(undefined);
        // The synthetic placeholder event proves cleanup clears never carry the reopening gesture.
        expect(cleanupCall?.[1].event.type).toBe('base-ui');
      },
    );

    it.skipIf(isJSDOM)(
      'releases the frozen query when reopening during the close animation with the input outside the popup',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 200ms linear;
          }
        `;

        const { user } = render(() => (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={style} />
            <Combobox.Root multiple items={['apple', 'apricot', 'banana']}>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        ));

        const input = screen.getByTestId('input');
        await user.type(input, 'app');
        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

        await user.click(screen.getByTestId('trigger'));

        await waitFor(() => expect(input).toHaveValue(''));
        expect(await screen.findByRole('option', { name: 'banana' })).not.toBe(null);
      },
    );

    it('does not close popup when filtering with input inside popup in multiple mode', async () => {
      const items = ['apple', 'apricot', 'banana'];
      const { user } = render(() => (
        <Combobox.Root multiple items={items}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await user.type(input, 'app');
      await user.click(screen.getByRole('option', { name: 'apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.to.equal(null);
      });
      expect(input).to.have.value('');
    });

    it('keeps the popup input focused through keyboard selection and restores the last selection', async () => {
      const items = ['apple', 'apricot', 'banana'];
      const { user } = render(() => (
        <Combobox.Root multiple items={items}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await user.type(input, 'ban');
      await user.keyboard('{ArrowDown}{Enter}');

      expect(screen.getByRole('dialog')).not.toBe(null);
      expect(input).toHaveFocus();
      expect(input).toHaveValue('');
      expect(trigger).toHaveTextContent('banana');
      expect(screen.getByRole('option', { name: 'banana' })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
      expect(trigger).toHaveFocus();

      await user.click(trigger);

      const selectedOption = await screen.findByRole('option', { name: 'banana' });
      expect(screen.getByTestId('input')).toHaveValue('');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(selectedOption).toHaveAttribute('data-highlighted'));
    });

    it.skipIf(isJSDOM)(
      'keeps filtered popup content stable while closing with input inside popup',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 100ms linear;
          }
        `;

        const items = ['apple', 'apricot', 'banana'];
        const { user } = render(() => (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={style} />
            <Combobox.Root multiple items={items}>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup
                    data-testid="popup"
                    class="animation-test-popup"
                    aria-label="Fruits"
                  >
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        ));

        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        const input = await screen.findByTestId('input');
        await user.type(input, 'zz');

        await waitFor(() => {
          expect(screen.getByRole('status')).toHaveTextContent('No matches');
        });
        expect(screen.queryByText('apple')).toBe(null);

        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => {
          expect(popup).toHaveAttribute('data-ending-style');
        });

        expect(screen.getByRole('status')).toHaveTextContent('No matches');
        expect(screen.queryByText('apple')).toBe(null);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });

        await user.click(trigger);

        const reopenedInput = await screen.findByTestId('input');
        expect(reopenedInput).toHaveValue('');
        expect(screen.getByText('apple')).not.toBe(null);
      },
    );

    it.skipIf(isJSDOM)(
      'keeps filtered popup content stable when input changes during the close animation',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 100ms linear;
          }
        `;

        const { user } = render(() => (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={style} />
            <Combobox.Root multiple items={['apple', 'apricot', 'banana']}>
              <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup data-testid="popup" class="animation-test-popup">
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        ));

        await user.click(screen.getByTestId('trigger'));
        const input = await screen.findByTestId('input');
        await user.type(input, 'ap');
        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

        await user.clear(input);

        expect(screen.getByText('apple')).not.toBe(null);
        expect(screen.getByText('apricot')).not.toBe(null);
        expect(screen.queryByText('banana')).toBe(null);
      },
    );

    it.skipIf(isJSDOM)(
      'clears the deferred popup input when reopening during close animation',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 100ms linear;
          }
        `;

        const items = ['apple', 'apricot', 'banana'];
        const { user } = render(() => (
          <>
            {/* eslint-disable-next-line react/no-danger */}
            <style innerHTML={style} />
            <Combobox.Root multiple items={items}>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup
                    data-testid="popup"
                    class="animation-test-popup"
                    aria-label="Fruits"
                  >
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        ));

        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        const input = await screen.findByTestId('input');
        await user.type(input, 'zz');

        await waitFor(() => {
          expect(screen.getByRole('status')).toHaveTextContent('No matches');
        });

        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => {
          expect(popup).toHaveAttribute('data-ending-style');
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(popup).not.toHaveAttribute('data-ending-style');
        });

        expect(screen.getByTestId('input')).toHaveValue('');
        expect(screen.getByText('apple')).not.toBe(null);
        expect(screen.getByText('banana')).not.toBe(null);
      },
    );

    it.skipIf(isJSDOM)(
      'does not emit another clear when controlled input is already empty on interrupted close',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 1s linear;
          }
        `;

        const onInputValueChange = vi.fn();

        function Test() {
          const [inputValue, setInputValue] = createSignal('');
          return (
            <>
              {/* eslint-disable-next-line react/no-danger */}
              <style innerHTML={style} />
              <Combobox.Root
                multiple
                items={['apple', 'banana']}
                inputValue={inputValue()}
                onInputValueChange={(value) => {
                  onInputValueChange(value);
                  setInputValue(value);
                }}
                onOpenChange={(open) => {
                  if (!open) {
                    setInputValue('');
                  }
                }}
              >
                <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup data-testid="popup" class="animation-test-popup">
                      <Combobox.Input data-testid="input" />
                      <Combobox.List>
                        {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            </>
          );
        }

        const { user } = render(() => <Test />);
        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);
        await user.type(await screen.findByTestId('input'), 'zz');
        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => {
          expect(popup).toHaveAttribute('data-ending-style');
        });
        expect(screen.getByTestId('input')).toHaveValue('');

        const callsBeforeReopen = onInputValueChange.mock.calls.length;

        await user.click(trigger);

        await waitFor(() => {
          expect(popup).not.toHaveAttribute('data-ending-style');
        });
        expect(screen.getByTestId('input')).toHaveValue('');
        expect(onInputValueChange).toHaveBeenCalledTimes(callsBeforeReopen);
      },
    );

    it('"multiple" clears typed input on close when no selection made', async () => {
      const onInput = spy();
      const { user } = render(() => (
        <Combobox.Root multiple defaultOpen onInputValueChange={onInput}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await flushMicrotasks();

      // Close without selecting
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).to.equal(null);
      expect(input).to.have.value('');
      expect(onInput.lastCall.args[0]).to.equal('');
      expect(onInput.lastCall.args[1].reason).to.equal(REASONS.inputClear);
    });

    it('does not clear popup input after canceled multiple value changes', async () => {
      const onInputValueChange = vi.fn();
      const onValueChange = vi.fn((value, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });

      const { user } = render(() => (
        <Combobox.Root
          multiple
          onInputValueChange={onInputValueChange}
          onValueChange={onValueChange}
        >
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByText('Open'));

      const input = await screen.findByTestId('input');
      // Wait for the popup to finish opening so the input is interactive (the positioner is
      // `inert` until then).
      await screen.findByRole('option', { name: 'apple' });
      await user.type(input, 'app');
      onInputValueChange.mockClear();

      await user.click(screen.getByRole('option', { name: 'apple' }));

      expect(onValueChange).toHaveBeenCalled();
      expect(input).toHaveValue('app');
      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('"single" clears typed input on close when no selection made (input outside popup)', async () => {
      const onInput = spy();
      const { user } = render(() => (
        <Combobox.Root defaultOpen onInputValueChange={onInput}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'zz');
      await flushMicrotasks();

      // Close without selecting
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('listbox')).to.equal(null));
      expect(input).to.have.value('');
      expect(onInput.lastCall.args[0]).to.equal('');
      expect(onInput.lastCall.args[1].reason).to.equal(REASONS.inputClear);
    });
  });

  describe('prop: filter', () => {
    it('uses custom filter to narrow results', async () => {
      const items = ['alpha', 'beta', 'alphabet', 'alpine'];
      const startsWith = (item: string, q: string) => item.toLowerCase().startsWith(q);

      const { user } = render(() => (
        <Combobox.Root items={items} filter={(item, q) => startsWith(String(item), q)}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.type(input, 'alp');
      await flushMicrotasks();

      // Only beta should be filtered out
      expect(screen.queryByText('beta')).to.equal(null);
      expect(screen.queryByText('alpha')).not.to.equal(null);
      expect(screen.queryByText('alphabet')).not.to.equal(null);
      expect(screen.queryByText('alpine')).not.to.equal(null);
    });

    it('resets filtered results after selecting when using a custom search stringifier', async () => {
      type Movie = { id: number; english: string; romaji: string };
      const movies: Movie[] = [
        { english: 'Spirited Away', id: 1, romaji: 'Sen to Chihiro no Kamikakushi' },
        { english: 'My Neighbor Totoro', id: 2, romaji: 'Tonari no Totoro' },
        { english: 'Princess Mononoke', id: 3, romaji: 'Mononoke Hime' },
      ];

      const stringifyMovie = (movie: Movie | null) =>
        movie ? `${movie.english} ${movie.romaji}` : '';

      function MultilingualFilterCombobox() {
        const [value, setValue] = createSignal<Movie | null>(null);
        const { contains } = Combobox.useFilter({ value });

        const filter = (item: Movie | null, query: string) => {
          if (!item) {
            return false;
          }
          return contains(item, query, stringifyMovie);
        };

        return (
          <Combobox.Root
            items={movies}
            value={value()}
            onValueChange={setValue}
            filter={filter}
            itemToStringLabel={(movie) => movie?.english ?? ''}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(movie: Movie) => <Combobox.Item value={movie}>{movie.english}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = render(() => <MultilingualFilterCombobox />);
      const input = screen.getByRole('combobox');

      await user.click(input);
      await screen.findByRole('listbox');

      await user.type(input, 'tonari');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Spirited Away' })).to.equal(null);
      });

      await user.click(screen.getByRole('option', { name: 'My Neighbor Totoro' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).to.equal(null);
      });

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Spirited Away' })).not.to.equal(null);
      });
    });
  });

  describe('prop: filteredItems', () => {
    it('resets external filteredItems when reopening after a selection', async () => {
      interface TestItem {
        id: number;
        label: string;
        label2: string;
      }

      const testItems: TestItem[] = [
        {
          id: 1,
          label: 'apple',
          label2: 'one',
        },
        {
          id: 2,
          label: 'orange',
          label2: 'two',
        },
        {
          id: 3,
          label: 'banana',
          label2: 'three',
        },
      ];

      function getItemLabelToFilter(item: TestItem | null) {
        return item ? `${item.label} ${item.label2}` : '';
      }

      function getItemLabelToDisplay(item: TestItem | null) {
        return item ? item.label || item.label2 : '';
      }

      function FilteredItemsCombobox() {
        const [searchValue, setSearchValue] = createSignal('');
        const [value, setValue] = createSignal<TestItem | null>(null);

        // Solid 2 has no deferred-value primitive (React's `useDeferredValue`); under `act` the
        // deferred value always catches up, so the latest value is equivalent here.
        const deferredSearchValue = searchValue;

        const { contains } = Combobox.useFilter({ value });

        const resolvedSearchValue = () =>
          searchValue() === '' || deferredSearchValue() === ''
            ? searchValue()
            : deferredSearchValue();

        const filteredItems = createMemo(() => {
          return testItems.filter((item) =>
            contains(item, resolvedSearchValue(), getItemLabelToFilter),
          );
        });

        return (
          <Combobox.Root
            items={testItems}
            filteredItems={filteredItems()}
            inputValue={searchValue()}
            onInputValueChange={setSearchValue}
            value={value()}
            onValueChange={setValue}
            itemToStringLabel={getItemLabelToDisplay}
            isItemEqualToValue={(item, v) => item?.id === v?.id}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.Empty>No items found.</Combobox.Empty>
                  <Combobox.List>
                    {(item: TestItem) => (
                      <Combobox.Item value={item}>
                        <Combobox.ItemIndicator />
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = render(() => <FilteredItemsCombobox />);
      const input = screen.getByRole('combobox');

      await user.click(input);
      await user.type(input, 'one');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'orange' })).to.equal(null);
      });

      await user.click(screen.getByRole('option', { name: 'apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).to.equal(null);
      });

      await user.click(input);

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'orange' })).not.to.equal(null);
      });
    });

    it('uses filteredItems when items prop is omitted', async () => {
      const fruits = ['Apple', 'Banana', 'Cherry'];

      function FilteredItemsOnlyCombobox() {
        const [value, setValue] = createSignal<string | null>(null);

        return (
          <Combobox.Root filteredItems={fruits} value={value()} onValueChange={setValue}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = render(() => <FilteredItemsOnlyCombobox />);
      const input = screen.getByTestId('input');

      await user.click(input);
      await screen.findByRole('listbox');
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).to.equal(null);
      });

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).not.to.equal(null);
      });
    });

    it('highlights the externally filtered item order when filtering reorders items', async () => {
      const fruits = ['Apple', 'Banana', 'Zucchini'];
      const onItemHighlighted = spy();

      function ReorderingFilteredItemsCombobox() {
        const [input, setInput] = createSignal('');
        const filteredItems = createMemo(() => {
          if (input().length > 0) {
            return [...fruits].reverse();
          }
          return fruits;
        });

        return (
          <Combobox.Root
            autoHighlight
            filteredItems={filteredItems()}
            inputValue={input()}
            onInputValueChange={setInput}
            onItemHighlighted={onItemHighlighted}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = render(() => <ReorderingFilteredItemsCombobox />);
      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      onItemHighlighted.resetHistory();

      await user.type(input, 'a');

      await waitFor(() => {
        expect(onItemHighlighted.callCount).to.be.greaterThan(0);
      });

      const [highlightedValue] = onItemHighlighted.lastCall.args;
      expect(highlightedValue).to.equal('Zucchini');
    });

    it('opens a reordered external list at the selected value in rendered-list coordinates', async () => {
      const fruits = ['Apple', 'Banana', 'Cherry'];
      const onItemHighlighted = vi.fn();

      const { user } = render(() => (
        <Combobox.Root
          items={fruits}
          filteredItems={['Cherry', 'Apple']}
          multiple
          defaultValue={['Apple']}
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByRole('combobox'));

      const apple = await screen.findByRole('option', { name: 'Apple' });
      const cherry = screen.getByRole('option', { name: 'Cherry' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));
      expect(cherry).not.toHaveAttribute('data-highlighted');
      expect(onItemHighlighted.mock.lastCall?.[0]).toBe('Apple');
    });

    it('resets an initially empty external result when opening a grouped selection', async () => {
      const groups = [
        { value: 'Fruits', items: ['Apple', 'Banana'] },
        { value: 'Vegetables', items: ['Carrot'] },
      ];

      const { user } = render(() => (
        <Combobox.Root items={groups} filteredItems={[]} defaultValue="Banana">
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(group: (typeof groups)[number]) => (
                    <Combobox.Group items={group.items}>
                      <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByTestId('input')).toHaveValue('Banana');

      await user.click(screen.getByTestId('input'));

      expect(await screen.findAllByRole('option')).toHaveLength(3);
      expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  describe('prop: openOnInputClick', () => {
    it('opens on input click by default', async () => {
      const { user } = render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      // Click input again should not toggle closed automatically
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));
    });

    it('does not open on input click when false, but opens on typing', async () => {
      const { user } = render(() => (
        <Combobox.Root openOnInputClick={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      expect(screen.queryByRole('listbox')).to.equal(null);

      await user.type(input, 'a');
      expect(screen.queryByRole('listbox')).not.to.equal(null);
    });
  });

  describe('scroll reset on input value change', () => {
    const manyItems = Array.from({ length: 50 }, (_, index) => `item-${index}`);

    it.skipIf(isJSDOM)(
      'resets the list scroll position to the top when the query changes',
      async () => {
        const filteringItems = Array.from({ length: 50 }, (_, index) =>
          index < 25 ? `alpha-${index}` : `beta-${index - 25}`,
        );

        const { user } = render(() => (
          <Combobox.Root items={filteringItems}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List style={{ 'max-height': '100px', 'overflow-y': 'auto' }}>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.click(input);

        const list = screen.getByRole('listbox');
        list.scrollTop = 40;
        expect(list.scrollTop).toBeGreaterThan(0);

        // Remove the current first item while keeping enough matches for the list to scroll.
        await user.type(input, 'b');

        await waitFor(() => {
          expect(list.scrollTop).toBe(0);
        });
      },
    );

    it.skipIf(isJSDOM)(
      'resets manually filtered children without deferring the reset until hover',
      async () => {
        const filteringItems = Array.from({ length: 50 }, (_, index) =>
          index < 25 ? `alpha-${index}` : `beta-${index - 25}`,
        );

        function ManuallyFilteredCombobox() {
          const [inputValue, setInputValue] = createSignal('');
          const visibleItems = () => filteringItems.filter((item) => item.startsWith(inputValue()));

          return (
            <Combobox.Root inputValue={inputValue()} onInputValueChange={setInputValue}>
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List style={{ 'max-height': '100px', 'overflow-y': 'auto' }}>
                      <For each={visibleItems()}>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </For>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = render(() => <ManuallyFilteredCombobox />);
        const input = screen.getByTestId('input');
        await user.click(input);

        const list = screen.getByRole('listbox');
        list.scrollTop = 40;
        expect(list.scrollTop).toBeGreaterThan(0);

        await user.type(input, 'b');

        await waitFor(() => {
          expect(list.scrollTop).toBe(0);
        });

        // A later highlight must not consume a typed-input reset that should already be cleared.
        list.scrollTop = 40;
        const visibleOption = screen.getByRole('option', { name: 'beta-5' });
        fireEvent.mouseMove(visibleOption, { pointerType: 'mouse' });
        await waitFor(() => {
          expect(visibleOption).toHaveAttribute('data-highlighted');
        });
        expect(list.scrollTop).toBe(40);
      },
    );

    it.skipIf(isJSDOM)(
      'resets the scroll position of a scrollable wrapper around the list',
      async () => {
        const { user } = render(() => (
          <Combobox.Root items={manyItems}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <div
                    data-testid="viewport"
                    style={{ 'max-height': '100px', 'overflow-y': 'auto' }}
                  >
                    <Combobox.List style={{ 'overflow-y': 'auto' }}>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </div>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.click(input);

        const viewport = screen.getByTestId('viewport');
        viewport.scrollTop = 40;
        expect(viewport.scrollTop).toBeGreaterThan(0);

        await user.type(input, 'item-1');

        await waitFor(() => {
          expect(viewport.scrollTop).toBe(0);
        });
      },
    );

    it.skipIf(isJSDOM)('skips clipping ancestors when finding the scroll container', async () => {
      const { user } = render(() => (
        <Combobox.Root items={manyItems}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <div data-testid="viewport" style={{ height: '100px', 'overflow-y': 'auto' }}>
                  <div style={{ 'overflow-y': 'clip' }}>
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </div>
                </div>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);

      const viewport = screen.getByTestId('viewport');
      viewport.scrollTop = 40;
      expect(viewport.scrollTop).toBeGreaterThan(0);

      await user.type(input, 'item-1');

      await waitFor(() => {
        expect(viewport.scrollTop).toBe(0);
      });
    });

    it.skipIf(isJSDOM)(
      'keeps the auto-highlighted first item in view after the query changes',
      async () => {
        const { user } = render(() => (
          <Combobox.Root items={manyItems} autoHighlight>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List style={{ 'max-height': '100px', 'overflow-y': 'auto' }}>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        await user.click(input);

        const list = screen.getByRole('listbox');
        list.scrollTop = 40;

        await user.type(input, 'item-1');

        await waitFor(() => {
          expect(list.scrollTop).toBe(0);
        });
      },
    );

    it.skipIf(isJSDOM)(
      'resets the scroll container when filtering reorders retained items',
      async () => {
        const items = Array.from({ length: 10 }, (_, index) => `item-${index}`);

        function ReorderingCombobox() {
          const [inputValue, setInputValue] = createSignal('');
          const filteredItems = () => (inputValue() === '' ? items : [...items].reverse());

          return (
            <Combobox.Root
              filteredItems={filteredItems()}
              inputValue={inputValue()}
              onInputValueChange={setInputValue}
            >
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List style={{ 'max-height': '60px', 'overflow-y': 'auto' }}>
                      {(item: string) => (
                        <Combobox.Item value={item} style={{ height: '24px' }}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = render(() => <ReorderingCombobox />);
        const input = screen.getByTestId('input');
        await user.click(input);

        const list = screen.getByRole('listbox');
        list.scrollTop = 40;
        expect(list.scrollTop).toBeGreaterThan(0);

        await user.type(input, 'x');

        await waitFor(() => {
          expect(screen.getAllByRole('option')[0]).toHaveTextContent('item-9');
        });
        await waitFor(() => {
          expect(list.scrollTop).toBe(0);
        });
      },
    );

    it.skipIf(isJSDOM)(
      'resets only the nearest scrollable wrapper when composed in a scrollable dialog',
      async () => {
        const { user } = render(() => (
          <Combobox.Root items={manyItems} inline open>
            <div
              role="dialog"
              data-testid="dialog"
              style={{ height: '80px', 'overflow-y': 'auto', 'overflow-anchor': 'none' }}
            >
              <div style={{ height: '100px' }} />
              <Combobox.Input data-testid="input" />
              <div data-testid="viewport" style={{ height: '100px', 'overflow-y': 'auto' }}>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </div>
            </div>
          </Combobox.Root>
        ));

        const input = screen.getByTestId('input');
        const dialog = screen.getByTestId('dialog');
        const viewport = screen.getByTestId('viewport');
        await user.click(input);
        dialog.scrollTop = 150;
        viewport.scrollTop = 40;
        const dialogScrollTop = dialog.scrollTop;
        expect(dialog.scrollTop).toBeGreaterThan(0);
        expect(viewport.scrollTop).toBeGreaterThan(0);

        await user.keyboard('item-1');

        await waitFor(() => {
          expect(viewport.scrollTop).toBe(0);
        });
        expect(dialog.scrollTop).toBe(dialogScrollTop);
      },
    );

    it.skipIf(isJSDOM)('does not reset a surrounding dialog', async () => {
      // Solid: the portal container is passed as the element itself.
      const [dialogElement, setDialogElement] = createSignal<HTMLDivElement>();
      const { user } = render(() => (
        <Combobox.Root items={manyItems} open>
          <div
            ref={setDialogElement}
            role="dialog"
            data-testid="dialog"
            style={{ height: '80px', 'overflow-y': 'auto', 'overflow-anchor': 'none' }}
          >
            <div style={{ height: '100px' }} />
            <Combobox.Input data-testid="input" />
            <Combobox.Portal container={dialogElement()}>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </div>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      const dialog = screen.getByTestId('dialog');
      await user.click(input);
      dialog.scrollTop = dialog.scrollHeight;
      const dialogScrollTop = dialog.scrollTop;
      expect(dialogScrollTop).toBeGreaterThan(0);

      await user.keyboard('item-1');

      expect(dialog.scrollTop).toBe(dialogScrollTop);
    });
  });

  describe('prop: autoHighlight', () => {
    it('does not auto-highlight on initial open when no selection', async () => {
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(screen.getByRole('listbox')).not.to.equal(null);
      expect(input).not.to.have.attribute('aria-activedescendant');
    });

    it('shows the selected item as selected on initial open (no active highlight)', async () => {
      render(() => (
        <Combobox.Root
          items={['apple', 'banana', 'cherry']}
          defaultValue="banana"
          autoHighlight
          defaultOpen
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const banana = screen.getByRole('option', { name: 'banana' });

      expect(banana).to.have.attribute('aria-selected', 'true');
      // Highlight is applied only after filtering begins
      expect(input).not.to.have.attribute('aria-activedescendant');
    });

    it('highlights the first matching item after typing (single mode)', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'ch');

      const cherry = await screen.findByRole('option', { name: 'cherry' });
      expect(input).to.have.attribute('aria-activedescendant', cherry.id);
    });

    it('highlights the first matching item after IME composition', async () => {
      render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight openOnInputClick={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      fireEvent.compositionStart(input);
      fireEvent.input(input, { target: { value: 'ch' } });
      fireEvent.compositionEnd(input, { data: 'ch' });

      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));
      const cherry = await screen.findByRole('option', { name: 'cherry' });
      await waitFor(() => expect(input).to.have.attribute('aria-activedescendant', cherry.id));
    });

    it('highlights the first matching item for a static list without the items prop', async () => {
      const { user } = render(() => (
        <Combobox.Root autoHighlight>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">alpha</Combobox.Item>
                  <Combobox.Item value="alphabet">alphabet</Combobox.Item>
                  <Combobox.Item value="beta">beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.type(input, 'al');

      const alpha = screen.getByRole('option', { name: 'alpha' });
      await waitFor(() => expect(alpha).to.have.attribute('data-highlighted'));
      expect(input).to.have.attribute('aria-activedescendant', alpha.id);

      await user.type(input, ' ');
      expect(alpha).to.have.attribute('data-highlighted');
      expect(input).to.have.attribute('aria-activedescendant', alpha.id);
    });

    it('keeps gridcell typeahead active across Space in row mode without selecting', async () => {
      const onValueChange = vi.fn();
      const { user } = render(() => (
        <Combobox.Root autoHighlight grid onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="new-york">new york</Combobox.Item>
                    <Combobox.Item value="new-jersey">new jersey</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="old-town">old town</Combobox.Item>
                    <Combobox.Item value="other">other</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.type(input, 'new');

      const newYork = screen.getByRole('gridcell', { name: 'new york' });
      await waitFor(() => expect(newYork).toHaveAttribute('data-highlighted'));
      expect(input).toHaveAttribute('aria-activedescendant', newYork.id);

      await user.type(input, ' ');
      expect(newYork).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', newYork.id);
      expect(input).toHaveValue('new ');
      expect(onValueChange.mock.calls.length > 0).toBe(false);
    });

    it('does not run follow-up state changes after canceled input value changes', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const onInputValueChange = vi.fn((value, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });

      const { user } = render(() => (
        <Combobox.Root
          defaultValue="apple"
          openOnInputClick={false}
          onInputValueChange={onInputValueChange}
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');

      await user.clear(input);

      expect(onInputValueChange).toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).toBe(null);

      onInputValueChange.mockClear();
      onOpenChange.mockClear();

      await user.type(input, 'b');

      expect(onInputValueChange).toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('retains highlight when query is cleared back to empty', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'a');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.to.equal(null);
      });
      await waitFor(() => expect(input).to.have.attribute('aria-activedescendant'));

      await user.clear(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));
      await waitFor(() => expect(input).to.have.attribute('aria-activedescendant'));
    });

    it('retains highlight when clearing the query with input-change behavior', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      await user.type(input, 'ban');
      await screen.findByRole('option', { name: 'banana' });
      await waitFor(() => expect(input).to.have.attribute('aria-activedescendant'));
      const highlightedBefore = input.getAttribute('aria-activedescendant');
      expect(highlightedBefore).to.not.equal(null);

      await user.clear(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));
      await waitFor(() => expect(input).to.have.attribute('aria-activedescendant'));
    });

    it('highlights the first matching item after typing (multiple mode)', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} multiple autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'ba');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.to.equal(null);
      });

      const activeId = input.getAttribute('aria-activedescendant');
      expect(activeId).to.not.equal(null);
      const activeEl = document.getElementById(activeId!);
      expect(activeEl?.textContent).to.equal('banana');
    });

    it('clears highlight after removing the highlighted chip while filtering (multiple mode)', async () => {
      const { user } = render(() => (
        <Combobox.Root
          items={['apple', 'banana', 'cherry']}
          multiple
          autoHighlight
          defaultOpen
          defaultValue={['apple']}
        >
          <Combobox.Chips>
            <Combobox.Value>
              {(value: Accessor<string[]>) => (
                <>
                  <For keyed={false} each={value()}>
                    {(item) => (
                      <Combobox.Chip>
                        {item()}
                        <Combobox.ChipRemove aria-label={`Remove ${item()}`} />
                      </Combobox.Chip>
                    )}
                  </For>
                  <Combobox.Input data-testid="input" />
                </>
              )}
            </Combobox.Value>
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.to.equal(null);
      });

      await user.type(input, 'a');
      await waitFor(() => expect(input).to.have.attribute('aria-activedescendant'));

      await user.click(screen.getByRole('button', { hidden: true, name: 'Remove apple' }));

      await waitFor(() => expect(input.getAttribute('aria-activedescendant')).to.equal(null));
    });

    it('keeps the active item highlighted after clearing the last selected value', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
        { id: 'rb', value: 'Ruby' },
      ];

      const { user } = render(() => (
        <Combobox.Root items={items} multiple>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item value={item}>{item.value}</Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      await user.click(screen.getByRole('option', { name: 'JavaScript' }));
      await user.click(screen.getByRole('option', { name: 'TypeScript' }));

      await user.type(input, 'pyth');
      await user.click(screen.getByRole('option', { name: 'Python' }));

      await waitFor(() => expect(screen.queryByRole('listbox')).to.equal(null));

      input.focus();
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      await user.hover(screen.getByRole('option', { name: 'JavaScript' }));
      await user.click(screen.getByRole('option', { name: 'JavaScript' }));
      await user.hover(screen.getByRole('option', { name: 'TypeScript' }));
      await user.click(screen.getByRole('option', { name: 'TypeScript' }));

      const pythonOption = screen.getByRole('option', { name: 'Python' });
      await user.hover(pythonOption);
      await user.click(pythonOption);

      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', pythonOption.id);
      });

      await user.keyboard('{ArrowDown}');
      const rubyOption = screen.getByRole('option', { name: 'Ruby' });
      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', rubyOption.id);
      });
    });

    it('does not shift highlight to the previous selected item on Enter deselect', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      const { user } = render(() => (
        <Combobox.Root items={items} multiple defaultValue={[items[0], items[1]]}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item value={item}>{item.value}</Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      const typeScriptOption = screen.getByRole('option', { name: 'TypeScript' });
      await user.hover(typeScriptOption);
      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(typeScriptOption).to.have.attribute('aria-selected', 'false');
        expect(input).to.have.attribute('aria-activedescendant', typeScriptOption.id);
      });
    });

    it('continues ArrowDown navigation from the Enter-selected item (multiple mode)', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      const { user } = render(() => (
        <Combobox.Root items={items} multiple>
          <Combobox.Chips>
            <Combobox.Value>
              {(value: Accessor<(typeof items)[number][]>) => (
                <>
                  <For each={value()}>
                    {(item) => (
                      <Combobox.Chip aria-label={item.value}>
                        {item.value}
                        <Combobox.ChipRemove aria-label={`Remove ${item.value}`} />
                      </Combobox.Chip>
                    )}
                  </For>
                  <Combobox.Input data-testid="input" />
                </>
              )}
            </Combobox.Value>
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item value={item}>{item.value}</Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      const typeScriptOption = screen.getByRole('option', { name: 'TypeScript' });
      await user.hover(typeScriptOption);
      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{ArrowDown}');

      const pythonOption = screen.getByRole('option', { name: 'Python' });
      await waitFor(() => {
        // In Solid, the chips render prop may replace the input node when the
        // first selected chip is inserted before it. Assert against the
        // current combobox element in the DOM.
        expect(input).to.have.attribute('aria-activedescendant', pythonOption.id);
      });
    });

    it('clears active highlight when removing the highlighted chip item', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      const { user } = render(() => (
        <Combobox.Root items={items} multiple defaultValue={[items[0], items[1]]}>
          <Combobox.Chips>
            <Combobox.Value>
              {(value) => (
                <>
                  <For each={value() as (typeof items)[number][]}>
                    {(item) => (
                      <Combobox.Chip aria-label={item.value}>
                        {item.value}
                        <Combobox.ChipRemove aria-label={`Remove ${item.value}`} />
                      </Combobox.Chip>
                    )}
                  </For>
                  <Combobox.Input data-testid="input" />
                </>
              )}
            </Combobox.Value>
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item value={item}>{item.value}</Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant');
      });

      const highlightedOption = document.getElementById(
        input.getAttribute('aria-activedescendant')!,
      );
      const highlightedLabel = highlightedOption?.textContent;
      expect(highlightedLabel).not.toBe(null);

      await user.click(
        screen.getByRole('button', { name: `Remove ${highlightedLabel as string}`, hidden: true }),
      );

      await waitFor(() => {
        expect(input.getAttribute('aria-activedescendant')).toBe(null);
      });
    });

    it('keeps highlight in sync after selecting then backspacing to a single match', async () => {
      const items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      const { user } = render(() => (
        <Combobox.Root items={items} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      // Select index 4
      await user.click(screen.getByRole('option', { name: 'epsilon' }));
      await waitFor(() => expect(screen.queryByRole('listbox')).to.equal(null));

      // Reopen and press Backspace to narrow to a single match
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      // Backspace once: from 'epsilon' -> 'epsilo', which should still only match 'epsilon'
      await user.keyboard('{Backspace}');
      const epsilon = await screen.findByRole('option', { name: 'epsilon' });
      // With autoHighlight, the first (and only) item should be highlighted
      await waitFor(() => expect(input).to.have.attribute('aria-activedescendant', epsilon.id));
    });

    it('navigates on first ArrowDown after editing selection to a new matching query', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['Apple', 'Grape', 'Grapefruit']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      // Open and select Apple
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      // Edit input to "Ape" (matches Grape and Grapefruit)
      await user.click(input);
      await user.clear(input);
      await user.type(input, 'Ape');
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      const grape = screen.getByRole('option', { name: 'Grape' });
      const grapefruit = screen.getByRole('option', { name: 'Grapefruit' });

      // With autoHighlight, first match is highlighted immediately
      await waitFor(() => expect(input).to.have.attribute('aria-activedescendant', grape.id));

      // One ArrowDown should move to the next match (no double keypress needed)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(input).to.have.attribute('aria-activedescendant', grapefruit.id));
    });

    it('updates highlighted callback with newly filtered first item', async () => {
      const onItemHighlighted = spy();
      const items = ['banana', 'apple', 'apricot'];

      const { user } = render(() => (
        <Combobox.Root
          items={items}
          autoHighlight
          defaultOpen
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');

      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));
      await user.click(input);
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted.callCount).to.be.greaterThan(0);
      });
      const [initialValue] = onItemHighlighted.lastCall.args;
      expect(initialValue).to.equal('banana');

      onItemHighlighted.resetHistory();

      await user.type(input, 'ap');

      await waitFor(() => {
        expect(onItemHighlighted.callCount).to.be.greaterThan(0);
      });
      const [nextValue, data] = onItemHighlighted.lastCall.args;
      expect(nextValue).to.equal('apple');
      expect(data.reason).to.equal('none');
      expect(data.index).to.equal(0);
    });

    it('fires a single clearing highlight on Enter selection', async () => {
      const onItemHighlighted = spy();

      const { user } = render(() => (
        <Combobox.Root
          items={['Apple', 'Apricot', 'Banana']}
          autoHighlight
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));
      await user.type(input, 'app');

      // Reset history to focus on close events only.
      onItemHighlighted.resetHistory();
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      const clearingCalls = onItemHighlighted
        .getCalls()
        .filter((call) => call.args[0] === undefined);
      expect(clearingCalls.length).to.equal(1);
      const postClearCalls = onItemHighlighted
        .getCalls()
        .slice(onItemHighlighted.getCalls().indexOf(clearingCalls[0]) + 1);
      expect(postClearCalls.every((c) => c.args[0] === undefined)).to.equal(true);
    });
  });

  describe('prop: onItemHighlighted', () => {
    it('fires on keyboard navigation', async () => {
      const items = ['a', 'b', 'c'];
      const onItemHighlighted = spy();

      const { user } = render(() => (
        <Combobox.Root items={items} onItemHighlighted={onItemHighlighted}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted.callCount).to.be.greaterThan(0);
      });
      const [value, eventDetails] = onItemHighlighted.lastCall.args;
      expect(value).to.equal('a');
      expect(eventDetails.reason).to.equal('keyboard');
      expect(eventDetails.index).to.equal(0);
    });
  });

  describe('highlight restoration when clearing the query', () => {
    it('returns the highlight to the selected item when the input is cleared', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} defaultValue="cherry">
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Select item">
                <Combobox.Input aria-label="Search" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search' });

      await user.type(input, 'ap');
      await screen.findByRole('option', { name: 'apple' });

      await user.clear(input);
      await screen.findByRole('option', { name: 'cherry' });

      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const activeId = input.getAttribute('aria-activedescendant');
      expect(document.getElementById(activeId!)?.textContent).toBe('cherry');
    });

    it('returns the highlight to the selected item without the items prop', async () => {
      const { user } = render(() => (
        <Combobox.Root defaultValue="cherry">
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Select item">
                <Combobox.Input aria-label="Search" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search' });

      await user.type(input, 'ap');
      await screen.findByRole('option', { name: 'apple' });

      await user.clear(input);
      await screen.findByRole('option', { name: 'cherry' });

      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const activeId = input.getAttribute('aria-activedescendant');
      expect(document.getElementById(activeId!)?.textContent).toBe('cherry');
    });

    it('restores an array-valued single selection when the query is cleared', async () => {
      const items = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];

      const { user } = render(() => (
        <Combobox.Root
          items={items}
          defaultValue={items[1]}
          itemToStringLabel={(item: number[]) => item.join('-')}
        >
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup aria-label="Select item">
                <Combobox.Input aria-label="Search" />
                <Combobox.List>
                  {(item: number[]) => <Combobox.Item value={item}>{item.join('-')}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Search' });

      // The array is a single-select value, not a list of selected values.
      const selected = screen.getByRole('option', { name: '3-4' });
      await waitFor(() => expect(selected).toHaveAttribute('data-highlighted'));

      await user.type(input, '1');
      await screen.findByRole('option', { name: '1-2' });

      await user.clear(input);
      const restored = await screen.findByRole('option', { name: '3-4' });
      await waitFor(() => expect(restored).toHaveAttribute('data-highlighted'));
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', restored.id));
    });

    it('does not highlight anything when there is no selected item', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.type(input, 'ap');
      await screen.findByRole('option', { name: 'apple' });

      await user.clear(input);
      await screen.findByRole('option', { name: 'cherry' });

      expect(input).not.toHaveAttribute('aria-activedescendant');
    });
  });

  describe('prop: open', () => {
    it('controls the open state', async () => {
      const [open, setOpen] = createSignal(false);
      const { user } = render(() => (
        <Combobox.Root open={open()}>
          <Combobox.Input />
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).to.equal(null);
      });

      act(() => setOpen(true));
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.to.equal(null);
      });

      await user.click(document.body);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.to.equal(null);
      });
    });

    it('keeps filtering responsive after selection when inline and open is controlled', async () => {
      const items = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];

      const { user } = render(() => (
        <Combobox.Root items={items} open inline>
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.type(input, 'ap');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).to.equal(null);
      });

      await user.click(screen.getByRole('option', { name: 'Apple' }));

      await user.clear(input);
      await user.type(input, 'ba');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Banana' })).not.to.equal(null);
      });
    });

    it('releases filtering when a controlled popup ignores a close request', async () => {
      const items = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];
      const onOpenChange = vi.fn();

      const { user } = render(() => (
        <Combobox.Root items={items} open onOpenChange={onOpenChange}>
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      await user.type(input, 'ap');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
      });

      await user.click(screen.getByRole('option', { name: 'Apple' }));

      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(screen.getByRole('dialog')).not.toBe(null);

      await user.clear(input);
      await user.type(input, 'ba');

      expect(input).toHaveValue('ba');
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Banana' })).not.toBe(null);
      });
      expect(screen.queryByRole('option', { name: 'Apple' })).toBe(null);
    });

    it.skipIf(isJSDOM)(
      'keeps filtered content stable when a controlled close is deferred',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 100ms linear;
          }
        `;

        function Test() {
          const [open, setOpen] = createSignal(true);
          const closeTimeout = useTimeout();

          return (
            <>
              {/* eslint-disable-next-line react/no-danger */}
              <style innerHTML={style} />
              <Combobox.Root
                items={['Apple', 'Apricot', 'Banana']}
                open={open()}
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) {
                    closeTimeout.start(50, () => setOpen(false));
                  }
                }}
              >
                <Combobox.Input data-testid="input" />
                <Combobox.Portal>
                  <Combobox.Positioner>
                    <Combobox.Popup data-testid="popup" class="animation-test-popup">
                      <Combobox.List>
                        {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            </>
          );
        }

        const { user } = render(() => <Test />);
        await user.type(screen.getByTestId('input'), 'ap');
        await user.click(screen.getByRole('option', { name: 'Apple' }));

        const popup = screen.getByTestId('popup');
        await waitFor(() => expect(popup).toHaveAttribute('data-ending-style'));

        expect(screen.getByTestId('input')).toHaveValue('Apple');
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.toBe(null);
      },
    );
  });

  describe('prop: onOpenChange', () => {
    it('fires when opening and closing', async () => {
      const onOpenChange = spy();

      const { user } = render(() => (
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Input />
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => {
        expect(onOpenChange.callCount).to.be.greaterThan(0);
      });
      expect(onOpenChange.lastCall.args[0]).to.equal(true);

      // Close by clicking outside
      await user.click(document.body);
      await waitFor(() => {
        expect(onOpenChange.lastCall.args[0]).to.equal(false);
      });
    });
  });

  describe('prop: defaultOpen', () => {
    it('opens by default', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByRole('listbox')).not.to.equal(null);
    });

    it('remains uncontrolled (can be closed via interaction)', async () => {
      const { user } = render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByRole('listbox')).not.to.equal(null);

      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).to.equal(null);
      });
    });

    it('is overridden by controlled open={false}', async () => {
      render(() => (
        <Combobox.Root defaultOpen open={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.queryByRole('listbox')).to.equal(null);
    });

    it('respects controlled open={true}', async () => {
      render(() => (
        <Combobox.Root defaultOpen open>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByRole('listbox')).not.to.equal(null);
    });
  });

  describe('prop: limit', () => {
    it('keeps the selected index unset when the selected item is outside the rendered limit', async () => {
      const items = ['apple', 'banana', 'cherry', 'date'];
      const { user } = render(() => (
        <Combobox.Root items={items} limit={2} defaultValue="date">
          <Combobox.Input />
          <SelectedIndexProbe />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');

      await user.click(screen.getByRole('combobox'));

      expect(screen.getAllByRole('option')).toHaveLength(2);
      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');
      expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute('data-highlighted');
      expect(screen.getByRole('option', { name: 'banana' })).not.toHaveAttribute(
        'data-highlighted',
      );
    });

    it('limits the number of items displayed when no groups are used', async () => {
      const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      render(() => (
        <Combobox.Root items={items} limit={3} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // Should only show the first 3 items
      expect(screen.getByRole('option', { name: 'apple' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.to.equal(null);
      expect(screen.queryByRole('option', { name: 'date' })).to.equal(null);
      expect(screen.queryByRole('option', { name: 'elderberry' })).to.equal(null);
    });

    it('limits the number of items displayed when groups are used', async () => {
      const items = [
        {
          items: ['orange', 'lemon', 'lime'],
          value: 'citrus',
        },
        {
          items: ['strawberry', 'blueberry', 'raspberry'],
          value: 'berries',
        },
      ];

      render(() => (
        <Combobox.Root items={items} limit={4} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(group) => (
                    <Combobox.Group items={group.items}>
                      <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // Should show first 4 items across groups
      expect(screen.getByRole('option', { name: 'orange' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'lemon' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'lime' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'strawberry' })).not.to.equal(null);
      // These should be limited out
      expect(screen.queryByRole('option', { name: 'blueberry' })).to.equal(null);
      expect(screen.queryByRole('option', { name: 'raspberry' })).to.equal(null);

      // Group labels should still be visible
      expect(screen.getByText('citrus')).not.to.equal(null);
      expect(screen.getByText('berries')).not.to.equal(null);
    });

    it('respects limit when filtering items', async () => {
      const items = ['apple', 'apricot', 'avocado', 'banana', 'blueberry'];
      const { user } = render(() => (
        <Combobox.Root items={items} limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('input');

      // Type 'a' to filter items starting with 'a'
      await user.type(input, 'a');
      await flushMicrotasks();

      // Should only show first 2 filtered items
      expect(screen.getByRole('option', { name: 'apple' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'apricot' })).not.to.equal(null);
      expect(screen.queryByRole('option', { name: 'avocado' })).to.equal(null);
      expect(screen.queryByRole('option', { name: 'banana' })).to.equal(null);
      expect(screen.queryByRole('option', { name: 'blueberry' })).to.equal(null);
    });

    it('stops filtering grouped items once the limit is reached', async () => {
      const items = [
        {
          value: 'groupA',
          items: ['banana', 'apple', 'apricot', 'avocado'],
        },
        {
          value: 'groupB',
          items: ['artichoke', 'banana', 'blueberry'],
        },
      ];

      const filter = vi.fn((itemValue: string, query: string) => itemValue.startsWith(query));

      const { user } = render(() => (
        <Combobox.Root items={items} filter={filter} limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(group) => (
                    <Combobox.Group items={group.items}>
                      <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      filter.mockClear();

      await user.type(screen.getByTestId('input'), 'a');
      await flushMicrotasks();

      const filteredItemValues = filter.mock.calls.map(([itemValue]) => itemValue);

      expect(filteredItemValues).not.toContain('avocado');
      expect(filteredItemValues).not.toContain('artichoke');
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apricot' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'avocado' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'artichoke' })).toBe(null);
    });

    it('shows all items when limit is -1 (default)', async () => {
      const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      render(() => (
        <Combobox.Root items={items} limit={-1} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // Should show all items
      expect(screen.getByRole('option', { name: 'apple' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'date' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'elderberry' })).not.to.equal(null);
    });

    it('handles limit of 0 gracefully', async () => {
      const items = ['apple', 'banana', 'cherry'];
      render(() => (
        <Combobox.Root items={items} limit={0} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // Should show no items
      expect(screen.queryByRole('option', { name: 'apple' })).to.equal(null);
      expect(screen.queryByRole('option', { name: 'banana' })).to.equal(null);
      expect(screen.queryByRole('option', { name: 'cherry' })).to.equal(null);
    });

    it('preserves order of items when applying limit across groups', async () => {
      const items = [
        {
          items: ['A1', 'A2'],
          value: 'groupA',
        },
        {
          items: ['B1', 'B2', 'B3'],
          value: 'groupB',
        },
      ];

      render(() => (
        <Combobox.Root items={items} limit={3} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(group) => (
                    <Combobox.Group items={group.items}>
                      <Combobox.GroupLabel>Group {group.value.slice(-1)}</Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // Should show first 3 items in order: A1, A2, B1
      expect(screen.getByRole('option', { name: 'A1' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'A2' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'B1' })).not.to.equal(null);
      expect(screen.queryByRole('option', { name: 'B2' })).to.equal(null);
      expect(screen.queryByRole('option', { name: 'B3' })).to.equal(null);
    });

    it('does not limit items when not using items prop', async () => {
      render(() => (
        <Combobox.Root limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                  <Combobox.Item value="date">date</Combobox.Item>
                  <Combobox.Item value="elderberry">elderberry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // Should show all items because limit only works with items prop
      expect(screen.getByRole('option', { name: 'apple' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'date' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'elderberry' })).not.to.equal(null);
    });

    it('updates displayed items when limit changes', async () => {
      const items = ['apple', 'banana', 'cherry', 'date'];
      const [limit, setLimit] = createSignal(2);
      render(() => (
        <Combobox.Root items={items} limit={limit()} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      // Initially shows 2 items
      expect(screen.getByRole('option', { name: 'apple' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.to.equal(null);
      expect(screen.queryByRole('option', { name: 'cherry' })).to.equal(null);
      expect(screen.queryByRole('option', { name: 'date' })).to.equal(null);

      // Update limit to 3
      act(() => setLimit(3));
      await flushMicrotasks();

      // Now shows 3 items
      expect(screen.getByRole('option', { name: 'apple' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.to.equal(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.to.equal(null);
      expect(screen.queryByRole('option', { name: 'date' })).to.equal(null);
    });
  });

  describe('dialog pattern', () => {
    const fruits = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];
    const asyncFruits = ['apple', 'banana', 'cherry'];

    function AsyncDialogCombobox() {
      const [loading, setLoading] = createSignal(true);
      const [value, setValue] = createSignal<string | null>(null);

      onSettled(() => {
        const timeout = setTimeout(() => setLoading(false), 0);
        return () => clearTimeout(timeout);
      });

      return (
        <Dialog.Root open>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <form>
                <label for="name">Name</label>
                <input id="name" disabled={loading()} />

                <label for="fruit">Fruit</label>
                <Combobox.Root
                  items={asyncFruits}
                  value={value()}
                  onValueChange={setValue}
                  disabled={loading()}
                >
                  <Combobox.Input id="fruit" placeholder="Select fruit..." />
                  <Combobox.Trigger aria-label="Open" />
                  <Combobox.Portal>
                    <Combobox.Positioner>
                      <Combobox.Popup>
                        <Combobox.List>
                          {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                        </Combobox.List>
                      </Combobox.Popup>
                    </Combobox.Positioner>
                  </Combobox.Portal>
                </Combobox.Root>

                <button type="button">Cancel</button>
                <button type="submit" disabled={loading()}>
                  Save
                </button>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    function DialogMultipleCombobox({ defaultOpen = true }: { defaultOpen?: boolean }) {
      const [open, setOpen] = createSignal(defaultOpen);
      return (
        <Combobox.Root multiple items={fruits} inline>
          <Dialog.Root open={open()} onOpenChange={setOpen}>
            <Dialog.Trigger>Trigger</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup aria-label="Fruit chooser">
                <Combobox.Chips>
                  <Combobox.Input data-testid="dialog-input" />
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Chips>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Combobox.Root>
      );
    }

    function DialogSingleCombobox({ defaultOpen = true }: { defaultOpen?: boolean }) {
      const [open, setOpen] = createSignal(defaultOpen);
      const inputId = createUniqueId();

      return (
        <Combobox.Root items={fruits} open={open()} onOpenChange={setOpen} inline>
          <Dialog.Root open={open()} onOpenChange={setOpen}>
            <Dialog.Trigger data-testid="dialog-trigger">
              <Combobox.Value>
                {(value) => <>{value() == null ? 'Select a fruit' : (value() as string)}</>}
              </Combobox.Value>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup aria-label="Fruit chooser">
                <div>
                  <label for={inputId}>Fruit</label>
                  <Combobox.Input
                    id={inputId}
                    data-testid="dialog-input"
                    placeholder="e.g. Apple"
                  />
                </div>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
                <Dialog.Close>Done</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Combobox.Root>
      );
    }

    it('does not let pending dialog initial focus steal focus from an async-enabled combobox', async () => {
      // Keep the dialog's initial-focus rAF pending until after the combobox click.
      // The GitHub repro depends on this timing; otherwise the rAF can fire before the click.
      const frameCallbacks = new Map<number, FrameRequestCallback>();
      let frameId = 0;
      const requestAnimationFrameSpy = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback) => {
          frameId += 1;
          frameCallbacks.set(frameId, callback);
          return frameId;
        });
      const cancelAnimationFrameSpy = vi
        .spyOn(window, 'cancelAnimationFrame')
        .mockImplementation((id) => {
          frameCallbacks.delete(id);
        });

      try {
        const { user } = render(() => <AsyncDialogCombobox />);

        await waitFor(() => expect(screen.getByLabelText('Fruit')).toBeEnabled());
        await user.click(screen.getByLabelText('Fruit'));

        expect(await screen.findByRole('listbox')).toBeVisible();

        act(() => {
          const callbacks = Array.from(frameCallbacks.values());
          frameCallbacks.clear();
          callbacks.forEach((callback) => callback(performance.now()));
        });

        expect(screen.getByLabelText('Fruit')).toHaveFocus();
        expect(screen.getByRole('listbox')).toBeVisible();
      } finally {
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
      }
    });

    describe('multiple', () => {
      it('clears input after filtering, removes filter and highlight', async () => {
        const { user } = render(() => <DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');

        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).to.equal(null);
        });
        expect(screen.getByRole('option', { name: 'Apple' })).not.to.equal(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.to.equal(null);

        await user.click(screen.getByRole('option', { name: 'Apple' }));

        expect(input).to.have.value('');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).not.to.equal(null);
        });
        expect(input).to.have.attribute('aria-activedescendant');
      });

      it('still filters after selecting an item', async () => {
        const { user } = render(() => <DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');

        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).to.equal(null);
        });
        expect(screen.getByRole('option', { name: 'Apple' })).not.to.equal(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.to.equal(null);

        await user.click(screen.getByRole('option', { name: 'Apple' }));

        expect(input).to.have.value('');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).not.to.equal(null);
        });
        expect(input).to.have.attribute('aria-activedescendant');

        await user.type(input, 'ap');

        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).to.equal(null);
        });
      });

      it('retains highlight on selected item when not filtering', async () => {
        const { user } = render(() => <DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        input.focus();

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          const apple = screen.getByRole('option', { name: 'Apple' });
          expect(input).to.have.attribute('aria-activedescendant', apple.id);
        });

        await user.keyboard('{Enter}');

        await waitFor(() => {
          const apple = screen.getByRole('option', { name: 'Apple' });
          expect(input).to.have.attribute('aria-activedescendant', apple.id);
        });
      });
    });

    describe('single', () => {
      it('closes the dialog after selecting an item and updates the trigger value', async () => {
        const { user } = render(() => <DialogSingleCombobox defaultOpen={false} />);

        const trigger = screen.getByTestId('dialog-trigger');
        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');
        await user.click(screen.getByRole('option', { name: 'Apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('dialog', { name: 'Fruit chooser' })).to.equal(null);
        });

        await waitFor(() => {
          expect(trigger).to.have.text('Apple');
        });
      });

      it('clears the filter input when re-opening after a selection', async () => {
        const { user } = render(() => <DialogSingleCombobox defaultOpen={false} />);

        const trigger = screen.getByTestId('dialog-trigger');
        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');
        await user.click(screen.getByRole('option', { name: 'Apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('dialog', { name: 'Fruit chooser' })).to.equal(null);
        });

        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const reopenedInput = await screen.findByTestId('dialog-input');

        expect(reopenedInput).to.have.value('');
        await screen.findByRole('option', { name: 'Banana' });
      });

      it('restores highlight when the input regains focus', async () => {
        const { user } = render(() => <DialogSingleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        input.focus();

        await user.keyboard('{ArrowDown}');

        const apple = screen.getByRole('option', { name: 'Apple' });

        await waitFor(() => {
          expect(apple).to.have.attribute('data-highlighted');
          expect(input).to.have.attribute('aria-activedescendant', apple.id);
        });

        const done = screen.getByRole('button', { name: 'Done' });
        fireEvent.blur(input, { relatedTarget: done });
        fireEvent.focus(done);

        await waitFor(() => {
          expect(input).not.to.have.attribute('aria-activedescendant');
          expect(apple).not.to.have.attribute('data-highlighted');
        });

        fireEvent.blur(done, { relatedTarget: input });
        fireEvent.focus(input);

        await waitFor(() => {
          expect(apple).to.have.attribute('data-highlighted');
          expect(input).to.have.attribute('aria-activedescendant', apple.id);
        });
      });
    });
  });

  describe('Form', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('submits stringified value to onFormSubmit when itemToStringValue is provided', async () => {
      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];
      const handleFormSubmit = vi.fn();

      const { user } = renderFakeTimers(() => (
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root
              items={items}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.code}
              defaultValue={items[0]}
            >
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: (typeof items)[number]) => (
                        <Combobox.Item value={item}>{item.label}</Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'US' });
    });

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = vi.fn((event: SubmitEvent & { currentTarget: HTMLFormElement }) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('country');
      });

      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];

      render(() => (
        <>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Combobox.Root
            name="country"
            form="external-form"
            items={items}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
            defaultValue={items[0]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: (typeof items)[number]) => (
                      <Combobox.Item value={item}>{item.label}</Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </>
      ));

      fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('US');
    });

    it.skipIf(isJSDOM)(
      'submits multiple values to an external form when `form` is provided',
      async () => {
        const submitSpy = vi.fn((event: SubmitEvent & { currentTarget: HTMLFormElement }) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.getAll('countries');
        });

        const items = [
          { code: 'US', label: 'United States' },
          { code: 'CA', label: 'Canada' },
          { code: 'AU', label: 'Australia' },
        ];

        render(() => (
          <>
            <form id="external-form" onSubmit={submitSpy}>
              <button type="submit">Submit</button>
            </form>
            <Combobox.Root
              multiple
              name="countries"
              form="external-form"
              items={items}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.code}
              defaultValue={[items[0], items[2]]}
            >
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: (typeof items)[number]) => (
                        <Combobox.Item value={item}>{item.label}</Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </>
        ));

        fireEvent.click(screen.getByRole('button'));

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toEqual(['US', 'AU']);
      },
    );

    describe('serialization for object values', () => {
      const items = [
        { value: 'US', label: 'United States' },
        { value: 'CA', label: 'Canada' },
        { value: 'AU', label: 'Australia' },
      ];

      it('serializes {value,label} objects using their value field', async () => {
        render(() => (
          <Combobox.Root
            name="country"
            items={items}
            itemToStringLabel={(item) => item.label}
            defaultValue={items[1]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: { value: string; label: string }) => (
                      <Combobox.Item value={item}>{item.label}</Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        const hiddenInput = screen.getByDisplayValue('CA');
        expect(hiddenInput.tagName).to.equal('INPUT');
        expect(hiddenInput).to.have.attribute('name', 'country');
      });

      it('serializes multiple {value,label} objects into multiple hidden inputs', async () => {
        const values = [items[0], items[2]];
        const { container } = render(() => (
          <Combobox.Root
            name="countries"
            items={items}
            itemToStringLabel={(item) => item.label}
            multiple
            defaultValue={values}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: { value: string; label: string }) => (
                      <Combobox.Item value={item}>{item.label}</Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        // eslint-disable-next-line testing-library/no-container -- Can't avoid container here. A better test would be checking form submission.
        const hiddenInputs = container.querySelectorAll('input[name="countries"]');
        expect(hiddenInputs).to.have.length(values.length);
        values.forEach((item, index) => {
          expect(hiddenInputs[index]).to.have.value(item.value);
        });
      });

      it('falls back to itemToStringValue when object lacks value', async () => {
        const codeItems = [
          { code: 'US', name: 'United States' },
          { code: 'CA', name: 'Canada' },
          { code: 'AU', name: 'Australia' },
        ];

        const { container } = render(() => (
          <Combobox.Root
            name="country"
            items={codeItems}
            itemToStringLabel={(item) => item.name}
            itemToStringValue={(item) => item.code}
            defaultValue={codeItems[0]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: { code: string; name: string }) => (
                      <Combobox.Item value={item}>{item.name}</Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        // eslint-disable-next-line testing-library/no-container -- Can't avoid container here. A better test would be checking form submission.
        const hiddenInput = container.querySelector('input[name="country"]');
        expect(hiddenInput).to.have.value('US');
      });
    });

    it('triggers native HTML validation on submit', async () => {
      const { user } = render(() => (
        <Form>
          <Field.Root name="test" data-testid="field">
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner />
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).to.equal(null);

      await user.click(submit);

      const error = screen.getByTestId('error');
      expect(error).to.have.text('required');
    });

    it('focuses trigger and surfaces errors when input is inside popup', async () => {
      let submittedCalls = 0;

      const handleSubmit = (event: SubmitEvent) => {
        event.preventDefault();
        submittedCalls += 1;
      };

      const { user } = render(() => (
        <Form onSubmit={handleSubmit}>
          <Field.Root name="combobox">
            <Combobox.Root required>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input render={(props) => <Input {...props} data-testid="input" />} />
                    <Combobox.List>
                      <Combobox.Item value="a">a</Combobox.Item>
                      <Combobox.Item value="b">b</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      expect(submittedCalls).toBe(0);

      const trigger = screen.getByTestId('trigger');

      await waitFor(() => expect(trigger).toHaveFocus());
      expect(trigger).toHaveAttribute('data-invalid', '');

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');

      await user.click(trigger);

      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('data-invalid');
    });

    it('submits when input renders a field-aware input', async () => {
      const handleFormSubmit = vi.fn();

      const { user } = render(() => (
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root items={['France', 'Germany']} required>
              <Combobox.Input render={(props) => <Input {...props} data-testid="input" />} />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('name', 'country');

      await user.click(input);
      await user.click(screen.getByRole('option', { name: 'France' }));
      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'France' });
    });

    it('submits when input inside popup renders a field-aware input', async () => {
      const handleFormSubmit = vi.fn();

      const { user } = render(() => (
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root items={['France', 'Germany']} required>
              <Combobox.Trigger>
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input render={(props) => <Input {...props} data-testid="input" />} />
                    <Combobox.List>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      await user.click(screen.getByRole('combobox'));
      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('name');

      await user.click(screen.getByRole('option', { name: 'France' }));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'country');
      expect(hiddenInput).toHaveValue('France');

      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'France' });
    });

    it('clears external errors on change', async () => {
      const { user } = renderFakeTimers(() => (
        <Form
          errors={{
            combobox: 'test',
          }}
        >
          <Field.Root name="combobox">
            <Combobox.Root>
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="a">a</Combobox.Item>
                      <Combobox.Item value="b">b</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      expect(screen.getByTestId('error')).to.have.text('test');

      const input = screen.getByTestId('input');
      expect(input).to.have.attribute('aria-invalid', 'true');

      await user.click(input);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'b' });
      clock.tick(200);
      await user.click(option);

      expect(screen.queryByTestId('error')).to.equal(null);
      expect(input).not.to.have.attribute('aria-invalid');
    });

    it('submits on Enter when no item is highlighted (does not prevent)', async () => {
      let submittedCalls = 0;

      const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
        event.preventDefault();
        submittedCalls += 1;
      };

      const { user } = render(() => (
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Combobox.Root items={['apple', 'banana']} openOnInputClick>
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const input = screen.getByRole('combobox');
      await user.click(input);
      // No navigation, so nothing highlighted
      await user.keyboard('{Enter}');

      expect(submittedCalls).to.equal(1);
    });

    it('prevents submit on Enter when an item is highlighted', async () => {
      let submittedCalls = 0;

      const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
        event.preventDefault();
        submittedCalls += 1;
      };

      const { user } = render(() => (
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Combobox.Root items={['alpha', 'beta']} openOnInputClick>
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(submittedCalls).to.equal(0);
    });
  });

  describe('Field', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('should receive disabled prop from Field.Root', async () => {
      render(() => (
        <Field.Root disabled>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      expect(input).to.have.attribute('disabled');

      const trigger = screen.getByTestId('trigger');
      expect(trigger).to.have.attribute('disabled');
    });

    it('should receive name prop from Field.Root', async () => {
      render(() => (
        <Field.Root name="field-combobox">
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).to.have.attribute('name', 'field-combobox');
    });

    it('Field.Label links to Combobox.Trigger when input is inside popup and trigger has an explicit id', async () => {
      render(() => (
        <Field.Root>
          <Field.Label data-testid="label">Search</Field.Label>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger" id="x-id">
              Open
            </Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const label = screen.getByTestId<HTMLLabelElement>('label');
      const trigger = screen.getByTestId('trigger');

      await waitFor(() => {
        expect(trigger).to.have.attribute('id', 'x-id');
        expect(label).to.have.attribute('for', 'x-id');
      });
    });

    it('does not apply validation ARIA attributes to input inside popup', async () => {
      const { user } = render(() => (
        <Field.Root invalid>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input data-testid="input" />
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" match />
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      const description = screen.getByTestId('description');
      const error = screen.getByTestId('error');
      const triggerDescribedBy = trigger.getAttribute('aria-describedby');

      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(triggerDescribedBy).toContain(description.id);
      expect(triggerDescribedBy).toContain(error.id);

      await user.click(trigger);

      const input = await screen.findByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');
      expect(input).not.toHaveAttribute('aria-describedby');
      expect(input).not.toHaveAttribute('data-valid');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(input).not.toHaveAttribute('data-touched');
      expect(input).not.toHaveAttribute('data-dirty');
      expect(input).not.toHaveAttribute('data-filled');
      expect(input).not.toHaveAttribute('data-focused');
    });

    it('Combobox.Label links to Combobox.Trigger when input is inside popup and trigger has an explicit id', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Label data-testid="label">Search</Combobox.Label>
          <Combobox.Trigger data-testid="trigger" id="x-id">
            Open
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const label = screen.getByTestId<HTMLDivElement>('label');
      const trigger = screen.getByTestId('trigger');

      /* eslint-disable testing-library/no-wait-for-multiple-assertions */
      await waitFor(() => {
        expect(trigger).toHaveAttribute('id', 'x-id');
        expect(trigger).toHaveAttribute('aria-labelledby', label.id);
      });
      /* eslint-enable testing-library/no-wait-for-multiple-assertions */
    });

    it('Combobox.Label focuses trigger without opening when input is inside popup', async () => {
      const { user } = render(() => (
        <Combobox.Root>
          <Combobox.Label data-testid="label">Search</Combobox.Label>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByTestId('label'));

      expect(screen.getByTestId('trigger')).toHaveFocus();
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('[data-touched]', async () => {
      render(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="">Select</Combobox.Item>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.to.have.attribute('data-dirty');
      expect(trigger).not.to.have.attribute('data-dirty');

      fireEvent.focus(input);
      fireEvent.blur(input);

      await flushMicrotasks();

      expect(input).to.have.attribute('data-touched', '');
      expect(trigger).to.have.attribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      const { user } = renderFakeTimers(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="">Select</Combobox.Item>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.to.have.attribute('data-dirty');
      expect(trigger).not.to.have.attribute('data-dirty');

      await user.click(input);
      await flushMicrotasks();
      clock.tick(200);

      const option = screen.getByRole('option', { name: 'Option 1' });

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.click(option);
      await flushMicrotasks();

      expect(input).to.have.attribute('data-dirty', '');
      expect(trigger).to.have.attribute('data-dirty', '');
    });

    it('removes [data-dirty] in multiple mode after returning to the initial value', async () => {
      const { user } = render(() => (
        <Field.Root>
          <Combobox.Root multiple defaultOpen defaultValue={['a']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');
      const optionB = screen.getByRole('option', { name: 'b' });

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(optionB);

      await waitFor(() => {
        expect(input).toHaveAttribute('data-dirty', '');
      });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      await user.click(optionB);

      await waitFor(() => {
        expect(input).not.toHaveAttribute('data-dirty');
      });
      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-dirty');
      });
    });

    it('removes [data-dirty] when an equal object value is reselected (different reference)', async () => {
      const options = [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
      ];

      const { user } = render(() => (
        <Field.Root>
          <Combobox.Root
            multiple
            defaultOpen
            items={options}
            // The initial value is a different object reference than the rendered items, equal only
            // by the `isItemEqualToValue` comparator.
            defaultValue={[{ id: 'a', label: 'a' }]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.id}
            isItemEqualToValue={(item, value) => item.id === value.id}
          >
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item) => <Combobox.Item value={item}>{item.label}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(screen.getByRole('option', { name: 'a' }));

      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      // Reselecting adds the item's object, a different reference than the initial value. The field
      // only returns to pristine if the dirty check compares via the provided comparator rather
      // than by reference.
      await user.click(screen.getByRole('option', { name: 'a' }));

      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-dirty');
      });
    });

    it('keeps [data-dirty] when the same values are reselected in a different order', async () => {
      const { user } = render(() => (
        <Field.Root>
          <Combobox.Root multiple defaultOpen defaultValue={['a', 'b']}>
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      // Deselect 'a' -> ['b'].
      await user.click(screen.getByRole('option', { name: 'a' }));
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      // Reselect 'a' -> ['b', 'a']. The set matches the initial value but the order differs.
      // Order is significant (it is preserved in form submission and compared element-by-element),
      // so the field stays dirty.
      await user.click(screen.getByRole('option', { name: 'a' }));
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when filled', async () => {
        const { user } = renderFakeTimers(() => (
          <Field.Root>
            <Combobox.Root>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="">Select</Combobox.Item>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
        ));

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        expect(input).not.to.have.attribute('data-filled');
        expect(trigger).not.to.have.attribute('data-filled');

        await user.click(input);
        await flushMicrotasks();
        clock.tick(200);

        const option = screen.getByRole('option', { name: 'Option 1' });

        // Arrow Down to focus the Option 1
        await user.keyboard('{ArrowDown}');
        await user.click(option);
        await flushMicrotasks();

        expect(input).to.have.attribute('data-filled', '');
        expect(trigger).to.have.attribute('data-filled', '');

        await user.click(input);

        await flushMicrotasks();

        const listbox = screen.getByRole('listbox');

        expect(listbox).not.to.have.attribute('data-filled');
      });

      it('adds [data-filled] attribute when already filled', async () => {
        render(() => (
          <Field.Root>
            <Combobox.Root defaultValue="1">
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
        ));

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        expect(input).to.have.attribute('data-filled');
        expect(trigger).to.have.attribute('data-filled');
      });
    });

    it('[data-focused]', async () => {
      render(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="">Select</Combobox.Item>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.to.have.attribute('data-focused');
      expect(trigger).not.to.have.attribute('data-focused');

      fireEvent.focus(input);

      expect(input).to.have.attribute('data-focused', '');
      expect(trigger).to.have.attribute('data-focused', '');

      fireEvent.blur(input);

      expect(input).not.to.have.attribute('data-focused');
      expect(trigger).not.to.have.attribute('data-focused');
    });

    it('does not mark as touched when focus moves into the popup', async () => {
      const validateSpy = spy(() => 'error');

      render(() => (
        <>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Combobox.Root>
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </>
      ));

      const trigger = screen.getByTestId('trigger');

      fireEvent.focus(trigger);
      fireEvent.click(trigger);

      await flushMicrotasks();

      const popup = screen.getByRole('dialog');

      fireEvent.blur(trigger, { relatedTarget: popup });
      fireEvent.focus(popup);

      await flushMicrotasks();

      expect(validateSpy.callCount).to.equal(0);
      expect(trigger).to.have.attribute('data-focused', '');
      expect(trigger).not.to.have.attribute('data-touched');
      expect(trigger).not.to.have.attribute('aria-invalid');
    });

    it('validates when the popup is blurred', async () => {
      const validateSpy = vi.fn(() => 'error');

      render(() => (
        <>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Combobox.Root>
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </>
      ));

      const trigger = screen.getByTestId('trigger');
      const outside = screen.getByTestId('outside');

      // Solid: React Testing Library's `focus`/`blur` also dispatch `focusin`/`focusout`; Solid's do not.
      fireEvent.focusIn(trigger);
      fireEvent.focus(trigger);
      fireEvent.click(trigger);

      await flushMicrotasks();

      const popup = screen.getByRole('dialog');

      fireEvent.focusOut(trigger, { relatedTarget: popup });
      fireEvent.blur(trigger, { relatedTarget: popup });
      fireEvent.focusIn(popup);
      fireEvent.focus(popup);

      fireEvent.focusOut(popup, { relatedTarget: outside });
      fireEvent.blur(popup, { relatedTarget: outside });
      fireEvent.focusIn(outside);
      fireEvent.focus(outside);

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });

      expect(trigger).toHaveAttribute('data-touched', '');
      expect(trigger).not.toHaveAttribute('data-focused');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('[data-invalid]', async () => {
      render(() => (
        <Field.Root invalid>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).to.have.attribute('data-invalid', '');
      expect(trigger).to.have.attribute('data-invalid', '');
    });

    it('[data-valid]', async () => {
      const { user } = render(() => (
        <Field.Root validationMode="onBlur">
          <Combobox.Root>
            <Combobox.Input data-testid="input" required />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.to.have.attribute('data-valid');
      expect(input).not.to.have.attribute('data-invalid');
      expect(trigger).not.to.have.attribute('data-valid');
      expect(trigger).not.to.have.attribute('data-invalid');

      // Select an option to produce a valid value, then blur to commit
      fireEvent.focus(input);
      await user.click(input);
      const option = await screen.findByRole('option', { name: 'Option 1' });

      await user.click(option);
      fireEvent.blur(input);

      await waitFor(() => expect(input).to.have.attribute('data-valid', ''));
      expect(trigger).to.have.attribute('data-valid', '');
      expect(input).not.to.have.attribute('data-invalid');
      expect(trigger).not.to.have.attribute('data-invalid');
    });

    it('prop: validate', async () => {
      render(() => (
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).not.to.have.attribute('aria-invalid');

      fireEvent.focus(input);
      fireEvent.blur(input);

      await flushMicrotasks();

      expect(input).to.have.attribute('aria-invalid', 'true');
    });

    it('passes raw value to validate when itemToStringValue is provided', async () => {
      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];
      const validateSpy = spy((value: unknown) => {
        expect(value).to.equal(items[0]);
        return 'error';
      });

      render(() => (
        <Field.Root validationMode="onBlur" validate={validateSpy}>
          <Combobox.Root
            items={items}
            defaultValue={items[0]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(validateSpy.callCount).to.equal(1);
      });
      expect(input).to.have.attribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onSubmit', async () => {
      const { user } = render(() => (
        <Form>
          <Field.Root validate={(val) => (val === 'a' ? 'error' : null)}>
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
              <Combobox.Clear data-testid="clear" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="a">a</Combobox.Item>
                      <Combobox.Item value="b">b</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const input = screen.getByTestId('input');
      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(screen.getByText('submit'));
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.click(input);

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(input).not.toHaveAttribute('aria-invalid');

      const clear = screen.getByTestId('clear');
      await user.click(clear);

      expect(document.activeElement).toBe(input);
      await user.keyboard('{Tab}');

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    // flaky in real browser
    it.skipIf(!isJSDOM)('prop: validationMode=onChange', async () => {
      const { user } = render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).not.to.have.attribute('aria-invalid');

      await user.click(input);

      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(input).to.have.attribute('aria-invalid', 'true');
    });

    // flaky in real browser
    it.skipIf(!isJSDOM)('prop: validationMode=onBlur', async () => {
      const { user } = render(() => (
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).not.to.have.attribute('aria-invalid');

      await user.click(input);

      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      fireEvent.blur(input);

      await flushMicrotasks();

      await waitFor(() => {
        expect(input).to.have.attribute('aria-invalid', 'true');
      });
    });

    it('Field.Label', async () => {
      render(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Label data-testid="label" nativeLabel={false} render="span" />
        </Field.Root>
      ));

      expect(screen.getByTestId('input')).to.have.attribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Combobox.Label does not label Combobox.Input and warns when input is the form control', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(() => (
        <Combobox.Root>
          <Combobox.Label data-testid="label" />
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await waitFor(() => {
        expect(errorSpy.mock.calls.length).toBe(1);
      });

      expect(errorSpy.mock.calls[0][0]).toContain(
        'Base UI: <Combobox.Label> labels <Combobox.Trigger> only.',
      );
      expect(screen.getByTestId('input')).not.toHaveAttribute('aria-labelledby');
      errorSpy.mockRestore();
    });

    it('does not set fallback aria-labelledby when no label is rendered', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="input" aria-label="Search" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('input')).not.toHaveAttribute('aria-labelledby');
      });
    });

    it('updates Combobox.Label linkage when root id changes', async () => {
      // Solid: props that the React test changes with `setProps` are held in a signal.
      const [rootProps, setRootProps] = createSignal<Record<string, any>>({ id: 'first' });
      render(() => (
        <Combobox.Root id={rootProps().id}>
          <Combobox.Label data-testid="label">Food</Combobox.Label>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      act(() => setRootProps((prev) => ({ ...prev, id: 'second' })));

      /* eslint-disable testing-library/no-wait-for-multiple-assertions */
      await waitFor(() => {
        const label = screen.getByTestId('label');
        const trigger = screen.getByTestId('trigger');
        expect(trigger).toHaveAttribute('id', 'second');
        expect(label.id).toBe('second-label');
        expect(trigger).toHaveAttribute('aria-labelledby', label.id);
      });
      /* eslint-enable testing-library/no-wait-for-multiple-assertions */
    });

    it('Field.Description', async () => {
      render(() => (
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Description data-testid="description" />
        </Field.Root>
      ));

      expect(screen.getByTestId('input')).to.have.attribute(
        'aria-describedby',
        screen.getByTestId('description').id,
      );
    });
  });

  describe('prop: isItemEqualToValue', () => {
    it('matches object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      render(() => (
        <Combobox.Root
          items={users}
          value={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
          defaultOpen
        >
          <Combobox.Input data-testid="input" />
          <span data-testid="value">
            <Combobox.Value />
          </span>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item.name}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByTestId('value')).to.have.text('Bob');
      expect(screen.getByRole('option', { name: 'Bob' })).to.have.attribute(
        'aria-selected',
        'true',
      );
    });

    it('properly deselects object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      render(() => (
        <Combobox.Root
          items={users}
          defaultValue={[{ id: 2, name: 'Bob' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
          defaultOpen
          multiple
        >
          <Combobox.Input data-testid="input" />
          <span data-testid="value">
            <Combobox.Value />
          </span>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item.name}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const option = screen.getByRole('option', { name: 'Bob' });

      fireEvent.click(option);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).to.have.attribute(
          'aria-selected',
          'false',
        );
      });
    });

    it('passes item as the first comparator argument in multiple mode', async () => {
      const users = [
        { id: 1, name: 'Alice', source: 'item' },
        { id: 2, name: 'Bob', source: 'item' },
      ];

      render(() => (
        <Combobox.Root
          items={users}
          defaultValue={[{ id: 2, name: 'Bob', source: 'selected' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) =>
            item.id === value.id && item.source === 'item' && value.source === 'selected'
          }
          defaultOpen
          multiple
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item.name}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const option = screen.getByRole('option', { name: 'Bob' });
      expect(option).to.have.attribute('aria-selected', 'true');

      fireEvent.click(option);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).to.have.attribute(
          'aria-selected',
          'false',
        );
      });
    });

    it('does not call comparator with null when clearing the value', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const compare = spy((item: any, value: any) => {
        if (value == null) {
          throw new Error('Compared against null');
        }
        return item.id === value.id;
      });

      const hiddenInputRef = useRef<HTMLInputElement | null>(null);

      const { user } = render(() => (
        <Combobox.Root
          items={users}
          defaultValue={users[0]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={compare}
          inputRef={hiddenInputRef}
        >
          <Combobox.Trigger>
            <Combobox.Value data-testid="value" />
          </Combobox.Trigger>
          <Combobox.Clear data-testid="clear" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => <Combobox.Item value={item}>{item.name}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const clear = await screen.findByTestId('clear');
      await user.click(clear);

      await waitFor(() => {
        expect(hiddenInputRef.current?.value ?? '').to.equal('');
      });

      expect(compare.callCount).to.be.greaterThan(0);
      compare.getCalls().forEach((call) => {
        expect(call.args[1]).not.to.equal(null);
      });
    });

    it('does not call comparator with undefined when items load asynchronously after opening', async () => {
      interface Country {
        code: string;
        label: string;
      }

      const loadedItems: Country[] = [
        { code: 'ca', label: 'Canada' },
        { code: 'us', label: 'United States' },
      ];

      const compare = spy((item: Country, value: Country) => {
        if (item == null || value == null) {
          throw new Error('Compared against undefined');
        }
        return item.code === value.code;
      });

      const handleInputValueChange = spy();
      const handleValueChange = spy();

      const [items, setItems] = createSignal<Country[] | undefined>(undefined);
      const { user } = render(() => (
        <Combobox.Root
          items={items()}
          value={loadedItems[0]}
          inputValue=""
          onInputValueChange={handleInputValueChange}
          onValueChange={handleValueChange}
          itemToStringLabel={(item: Country) => item.label}
          isItemEqualToValue={compare}
          filter={null}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: Country) => <Combobox.Item value={item}>{item.label}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.click(input);

      act(() => setItems(loadedItems));

      const canada = await screen.findByRole('option', { name: 'Canada' });
      fireEvent.mouseMove(canada, { pointerType: 'mouse' });
      await waitFor(() => expect(canada).to.have.attribute('data-highlighted'));
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'United States' })).to.have.attribute(
          'data-highlighted',
        );
      });

      expect(compare.callCount).to.be.greaterThan(0);
      compare.getCalls().forEach((call) => {
        expect(call.args[0]).not.to.equal(null);
        expect(call.args[0]).not.to.equal(undefined);
        expect(call.args[1]).not.to.equal(null);
        expect(call.args[1]).not.to.equal(undefined);
      });
    });

    it('keeps showing items after selecting in controlled input-inside-popup async load flow', async () => {
      interface Country {
        code: string;
        label: string;
      }

      const loadedItems: Country[] = [
        { code: 'ca', label: 'Canada' },
        { code: 'us', label: 'United States' },
      ];

      function AsyncControlledCombobox(props: { countries: Country[] | undefined }) {
        const [country, setCountry] = createSignal<Country | null>(null);
        const [inputValue, setInputValue] = createSignal('');

        return (
          <Combobox.Root
            items={props.countries}
            filter={null}
            value={country()}
            inputValue={inputValue()}
            onInputValueChange={setInputValue}
            isItemEqualToValue={(item, selected) => item?.code === selected?.code}
            onValueChange={(value) => {
              if (country()?.code === value?.code) {
                setCountry(null);
              } else {
                setCountry(value);
              }
            }}
          >
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.Empty data-testid="empty">No countries found.</Combobox.Empty>
                  <Combobox.List>
                    {(item: Country) => <Combobox.Item value={item}>{item.label}</Combobox.Item>}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const [countries, setCountries] = createSignal<Country[] | undefined>(undefined);
      const { user } = render(() => <AsyncControlledCombobox countries={countries()} />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      act(() => setCountries(loadedItems));

      const canada = await screen.findByRole('option', { name: 'Canada' });
      fireEvent.mouseMove(canada, { pointerType: 'mouse' });
      await waitFor(() => expect(canada).to.have.attribute('data-highlighted'));

      await user.click(canada);
      await waitFor(() => expect(screen.queryByRole('listbox')).to.equal(null));

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Canada' })).not.to.equal(null);
        expect(screen.getByRole('option', { name: 'United States' })).not.to.equal(null);
      });
    });
  });

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);

      const banana = screen.getByRole('option', { name: 'banana' });
      fireEvent.mouseMove(banana, { pointerType: 'mouse' });

      await waitFor(() => expect(banana).to.have.attribute('data-highlighted'));
      expect(input.getAttribute('aria-activedescendant')).to.equal(banana.id);
    });

    it('does not highlight items from mouse movement when disabled', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} highlightItemOnHover={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);

      const banana = screen.getByRole('option', { name: 'banana' });
      fireEvent.mouseMove(banana, { pointerType: 'mouse' });

      await waitFor(() => expect(input).not.to.have.attribute('aria-activedescendant'));
      expect(banana).not.to.have.attribute('data-highlighted');
    });
  });

  describe('prop: loopFocus', () => {
    it('loops focus from last to first item with ArrowDown by default', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      input.focus();

      // ArrowUp opens and focuses last item
      await user.keyboard('{ArrowUp}');

      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', options[2].id);
      });

      // Loop cycles through input
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).not.to.have.attribute('aria-activedescendant');
      });

      // Then to first item
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', options[0].id);
      });
    });

    it('loops focus from first to last item with ArrowUp by default', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      input.focus();

      // ArrowDown opens and focuses first item
      await user.keyboard('{ArrowDown}');

      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', options[0].id);
      });

      // Loop cycles through input
      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(input).not.to.have.attribute('aria-activedescendant');
      });

      // Then to last item
      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', options[2].id);
      });
    });

    it('does not loop focus from last to first with ArrowDown when loopFocus={false}', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} loopFocus={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      input.focus();

      // ArrowUp opens and focuses last item
      await user.keyboard('{ArrowUp}');

      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', options[2].id);
      });

      // Should stay at last item (no loop)
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', options[2].id);
      });
    });

    it('does not loop focus from first to last with ArrowUp when loopFocus={false}', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple', 'banana', 'cherry']} loopFocus={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole<HTMLInputElement>('combobox');
      input.focus();

      // ArrowDown opens and focuses first item
      await user.keyboard('{ArrowDown}');

      await waitFor(() => expect(screen.getByRole('listbox')).not.to.equal(null));

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', options[0].id);
      });

      // Should stay at first item (no loop)
      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(input).to.have.attribute('aria-activedescendant', options[0].id);
      });
    });
  });

  describe('coverage edge cases', () => {
    it('allows an attempted open to be canceled', async () => {
      const onOpenChange = vi.fn((_open, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });
      const { user } = render(() => (
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      await user.click(screen.getByRole('combobox'));

      expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything());
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('handles closing after a changed query is cleared', async () => {
      const { user } = render(() => (
        <Combobox.Root defaultOpen items={['apple']}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.type(input, 'a');
      await user.clear(input);
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('clears a multiple inline query on close', async () => {
      const { user } = render(() => (
        <Combobox.Root multiple inline open items={['apple']}>
          <Combobox.Input data-testid="inline-input" />
          <Combobox.Trigger>Toggle</Combobox.Trigger>
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      const input = screen.getByTestId('inline-input');
      await user.type(input, 'a');
      fireEvent.click(screen.getByText('Toggle'));

      expect(input).toHaveValue('');
    });

    it('normalizes a controlled null value when selecting in multiple mode', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <Combobox.Root multiple value={null as never} defaultOpen onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.List>
            <Combobox.Item value="apple">apple</Combobox.Item>
          </Combobox.List>
        </Combobox.Root>
      ));

      fireEvent.click(screen.getByRole('option', { name: 'apple' }));

      expect(onValueChange).toHaveBeenCalledWith(['apple'], expect.anything());
    });

    it('normalizes a controlled null value while closed in multiple mode', async () => {
      render(() => (
        <Combobox.Root multiple value={null as never} items={['apple']}>
          <Combobox.Input />
          <SelectedIndexProbe />
        </Combobox.Root>
      ));

      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');
    });

    it('does not seed an initial highlight for an unmatched inline value', async () => {
      render(() => (
        <Combobox.Root inline open defaultValue="missing" items={['apple']}>
          <Combobox.Input />
          <SelectedIndexProbe />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      expect(screen.getByTestId('selected-index')).toHaveTextContent('null');
    });

    it('seeds the initial highlight for a matched inline value', async () => {
      render(() => (
        <Combobox.Root inline open defaultValue="apple" items={['apple']}>
          <Combobox.Input />
          <SelectedIndexProbe />
          <Combobox.List>
            {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Root>
      ));

      expect(screen.getByTestId('selected-index')).toHaveTextContent('0');
    });

    it('restores the first highlight after an always-highlighted query becomes empty', async () => {
      const { user } = render(() => (
        <Autocomplete.Root defaultOpen autoHighlight="always" items={['apple']}>
          <Autocomplete.Input />
          <Autocomplete.List>
            {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
          </Autocomplete.List>
        </Autocomplete.Root>
      ));

      const input = screen.getByRole('combobox');
      await user.type(input, 'z');
      expect(screen.queryByRole('option')).toBe(null);

      await user.clear(input);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'apple' })).toHaveAttribute('data-highlighted');
      });
    });

    it('omits groups with no matching items', async () => {
      const items = [
        { value: 'fruit', items: ['apple'] },
        { value: 'vegetables', items: ['broccoli'] },
      ];
      const { user } = render(() => (
        <Combobox.Root defaultOpen items={items}>
          <Combobox.Input />
          <Combobox.List>
            {(group) => (
              <Combobox.Group items={group.items}>
                <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                <Combobox.Collection>
                  {(item) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                </Combobox.Collection>
              </Combobox.Group>
            )}
          </Combobox.List>
        </Combobox.Root>
      ));

      await user.type(screen.getByRole('combobox'), 'app');

      expect(screen.getByText('fruit')).not.toBe(null);
      expect(screen.queryByText('vegetables')).toBe(null);
    });

    it('exposes an action that completes unmount cleanup', async () => {
      const actionsRef: { current: Combobox.Root.Actions | null } = { current: null };
      const onOpenChangeComplete = vi.fn();
      render(() => (
        <Combobox.Root
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
        >
          <Combobox.Input />
        </Combobox.Root>
      ));

      act(() => actionsRef.current?.unmount());

      expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
    });

    it('moves focus from the hidden control to an external input', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Input data-testid="visible-input" />
        </Combobox.Root>
      ));
      const visibleInput = screen.getByTestId('visible-input');
      const hiddenInput = getHiddenControl();

      fireEvent.focus(hiddenInput);

      expect(visibleInput).toHaveFocus();
    });

    it('falls back to the trigger when the hidden control is focused', async () => {
      render(() => (
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        </Combobox.Root>
      ));
      const hiddenInput = getHiddenControl();

      fireEvent.focus(hiddenInput);

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('falls back to the trigger after an external input unmounts', async () => {
      const [showInput, setShowInput] = createSignal(true);

      render(() => (
        <Combobox.Root>
          <Show
            when={showInput()}
            fallback={<Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>}
          >
            <Combobox.Input />
          </Show>
        </Combobox.Root>
      ));
      act(() => setShowInput(false));

      fireEvent.focus(getHiddenControl());

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('moves hidden-control focus to the trigger when the input is inside the popup', async () => {
      render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      fireEvent.focus(getHiddenControl());

      expect(screen.getByTestId('trigger')).toHaveFocus();
    });

    it('safely handles hidden-control focus without a visible control', async () => {
      render(() => <Combobox.Root />);
      const hiddenInput = getHiddenControl();

      fireEvent.focus(hiddenInput);

      expect(document.body).toHaveFocus();
    });

    it('ignores scalar browser autofill in multiple mode', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <Combobox.Root multiple onValueChange={onValueChange}>
          <Combobox.Input data-testid="visible-input" />
        </Combobox.Root>
      ));
      const hiddenInput = getHiddenControl();

      fireEvent.input(hiddenInput, { target: { value: 'apple' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('ignores unmatched browser autofill in single mode', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <Combobox.Root name="fruit" items={['apple']} onValueChange={onValueChange}>
          <Combobox.Input />
        </Combobox.Root>
      ));
      const hiddenInput = screen
        .getAllByDisplayValue('')
        .find((element) => element.getAttribute('name') === 'fruit')!;

      fireEvent.input(hiddenInput, { target: { value: 'orange' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not request form submission when no form owns the autocomplete', async () => {
      render(() => (
        <Autocomplete.Root defaultOpen submitOnItemClick>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      ));

      fireEvent.click(screen.getByRole('option', { name: 'apple' }));
      expect(screen.getByRole('combobox')).toHaveValue('apple');
    });

    it('does not request form submission when requestSubmit is unavailable', async () => {
      render(() => (
        <form aria-label="search">
          <Autocomplete.Root defaultOpen submitOnItemClick>
            <Autocomplete.Input />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </form>
      ));
      const form = screen.getByRole('form', { name: 'search' });
      Object.defineProperty(form, 'requestSubmit', { configurable: true, value: undefined });

      fireEvent.click(screen.getByRole('option', { name: 'apple' }));
      expect(screen.getByRole('combobox')).toHaveValue('apple');
    });

    it('validates the autocomplete input when focus leaves its popup', async () => {
      const validate = vi.fn();
      const { user } = render(() => (
        <Field.Root validationMode="onBlur" validate={validate}>
          <Autocomplete.Root defaultOpen defaultValue="query">
            <Autocomplete.Trigger>Open</Autocomplete.Trigger>
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.Input />
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>
      ));

      await user.click(document.body);

      await waitFor(() => {
        expect(validate).toHaveBeenCalledWith('query', expect.anything());
      });
    });
  });

  describe('within Composite', () => {
    it('should navigate between combobox and composite items', async () => {
      const { user } = render(() => (
        <CompositeRoot orientation="horizontal">
          <CompositeItem tag="button">Item 1</CompositeItem>
          <CompositeItem tag="button">Item 2</CompositeItem>
          <Combobox.Root>
            <Combobox.Input render={(props) => <CompositeItem tag="input" props={[props]} />} />
          </Combobox.Root>
        </CompositeRoot>
      ));

      const input = screen.getByRole('combobox');
      await user.click(input);

      await user.keyboard('{ArrowLeft}');
      const button2 = screen.getByRole('button', { name: 'Item 2' });
      expect(button2).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();
    });
  });
});
