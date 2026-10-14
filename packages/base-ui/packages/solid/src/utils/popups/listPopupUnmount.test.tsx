import { createSignal, flush } from 'solid-js';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createRenderer, flushMicrotasks } from '#test-utils';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { Combobox } from '@solidports/base-ui/combobox';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { Select } from '@solidports/base-ui/select';

/**
 * 1.9 closes these popups on their own. `preventUnmountOnClose()` is the only opt-out, and
 * `actionsRef.unmount()` finishes that close. Providing `actionsRef` alone does not keep them
 * mounted.
 */
describe('popup preventUnmountOnClose', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describe('Combobox', () => {
    it('opens without recording an unmount opt-out', async () => {
      const { user } = render(() => (
        <Combobox.Root items={['apple']}>
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

      expect(screen.queryByRole('listbox')).toBeNull();
      await user.click(screen.getByRole('combobox'));
      await flushMicrotasks();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeTruthy();
    });

    it('unmounts a normal close even when an actions ref is provided', async () => {
      const actionsRef: { current: Combobox.Root.Actions | null } = { current: null };
      const { user } = render(() => (
        <Combobox.Root defaultOpen actionsRef={actionsRef} items={['apple']}>
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

      expect(screen.getByRole('listbox')).toBeTruthy();
      await user.click(screen.getByRole('option', { name: 'apple' }));
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('stays mounted until unmount() when the close opts out', async () => {
      const actionsRef: { current: Combobox.Root.Actions | null } = { current: null };
      const onOpenChangeComplete = vi.fn();
      const { user } = render(() => (
        <Combobox.Root
          defaultOpen
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          items={['apple']}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
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

      await user.click(screen.getByRole('option', { name: 'apple' }));
      await flushMicrotasks();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('listbox')).not.toBeNull();
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      act(() => actionsRef.current?.unmount());
      flush();
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
    });

    it('closes through the close action so onOpenChange can opt out', async () => {
      const actionsRef: { current: Combobox.Root.Actions | null } = { current: null };
      const reasons: string[] = [];
      render(() => (
        <Combobox.Root
          defaultOpen
          actionsRef={actionsRef}
          items={['apple']}
          onOpenChange={(open, details) => {
            reasons.push(details.reason);
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
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

      act(() => actionsRef.current!.close());
      await flushMicrotasks();
      expect(reasons).toEqual(['imperative-action']);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('listbox')).not.toBeNull();

      act(() => actionsRef.current!.unmount());
      flush();
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('does not call onOpenChange when close runs while the popup is closed', async () => {
      const actionsRef: { current: Combobox.Root.Actions | null } = { current: null };
      const onOpenChange = vi.fn();
      render(() => (
        <Combobox.Root actionsRef={actionsRef} items={['apple']} onOpenChange={onOpenChange}>
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

      act(() => actionsRef.current!.close());
      await flushMicrotasks();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    });

    it('unmounts an inline list by watching the surrounding dialog', async () => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      document.body.appendChild(dialog);
      const [open, setOpen] = createSignal(true);
      try {
        render(() => (
          <Combobox.Root inline open={open()} items={['apple']}>
            <Combobox.Input />
            <Combobox.Portal container={dialog}>
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

        expect(dialog.contains(screen.getByRole('listbox'))).toBe(true);
        // An inline list stays expanded while its open state is closed, so close through the prop.
        // The exit watches the dialog the positioner was portaled into.
        setOpen(false);
        flush();
        await flushMicrotasks();
        expect(screen.queryByRole('listbox')).toBeNull();
      } finally {
        dialog.remove();
      }
    });

    it('does not keep the popup mounted when a canceled close opts out', async () => {
      const [open, setOpen] = createSignal(true);
      let cancel = true;
      const { user } = render(() => (
        <Combobox.Root
          open={open()}
          items={['apple']}
          onOpenChange={(next, details) => {
            if (!next && cancel) {
              details.preventUnmountOnClose();
              details.cancel();
              return;
            }
            setOpen(next);
          }}
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

      await user.click(screen.getByRole('option', { name: 'apple' }));
      await flushMicrotasks();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).not.toBeNull();

      cancel = false;
      setOpen(false);
      flush();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('Autocomplete', () => {
    it('stays mounted until unmount() when the close opts out', async () => {
      const actionsRef: { current: Autocomplete.Root.Actions | null } = { current: null };
      const { user } = render(() => (
        <Autocomplete.Root
          defaultOpen
          actionsRef={actionsRef}
          items={['alpha']}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      ));

      await user.click(screen.getByRole('option', { name: 'alpha' }));
      await flushMicrotasks();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('listbox')).not.toBeNull();

      act(() => actionsRef.current?.unmount());
      flush();
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('closes through the close action so onOpenChange can opt out', async () => {
      const actionsRef: { current: Autocomplete.Root.Actions | null } = { current: null };
      const reasons: string[] = [];
      render(() => (
        <Autocomplete.Root
          defaultOpen
          actionsRef={actionsRef}
          items={['alpha']}
          onOpenChange={(open, details) => {
            reasons.push(details.reason);
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      ));

      act(() => actionsRef.current!.close());
      await flushMicrotasks();
      expect(reasons).toEqual(['imperative-action']);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('listbox')).not.toBeNull();

      act(() => actionsRef.current!.unmount());
      flush();
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('Select', () => {
    it('opens without recording an unmount opt-out', async () => {
      const { user } = render(() => (
        <Select.Root defaultValue="a">
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">A</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.queryByRole('listbox')).toBeNull();
      await user.click(screen.getByRole('combobox'));
      // A mouse press opens on the next animation frame, once focus has settled.
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
      });
      expect(screen.getByRole('listbox')).toBeTruthy();
    });

    it('unmounts a normal close even when an actions ref is provided', async () => {
      const actionsRef: { current: Select.Root.Actions | null } = { current: null };
      const { user } = render(() => (
        <Select.Root defaultOpen defaultValue="a" actionsRef={actionsRef}>
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">A</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByRole('listbox')).toBeTruthy();
      await user.click(screen.getByRole('option', { name: 'A' }));
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('stays mounted until unmount() when the close opts out', async () => {
      const actionsRef: { current: Select.Root.Actions | null } = { current: null };
      const { user } = render(() => (
        <Select.Root
          defaultOpen
          defaultValue="a"
          actionsRef={actionsRef}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">A</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await user.click(screen.getByRole('option', { name: 'A' }));
      await flushMicrotasks();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('listbox')).not.toBeNull();

      act(() => actionsRef.current?.unmount());
      flush();
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('closes through the close action so onOpenChange can opt out', async () => {
      const actionsRef: { current: Select.Root.Actions | null } = { current: null };
      const reasons: string[] = [];
      render(() => (
        <Select.Root
          defaultOpen
          defaultValue="a"
          actionsRef={actionsRef}
          onOpenChange={(open, details) => {
            reasons.push(details.reason);
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">A</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      act(() => actionsRef.current!.close());
      await flushMicrotasks();
      expect(reasons).toEqual(['imperative-action']);
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('listbox')).not.toBeNull();

      act(() => actionsRef.current!.unmount());
      flush();
      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('does not call onOpenChange when close runs while the popup is closed', async () => {
      const actionsRef: { current: Select.Root.Actions | null } = { current: null };
      const onOpenChange = vi.fn();
      render(() => (
        <Select.Root actionsRef={actionsRef} onOpenChange={onOpenChange}>
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">A</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      act(() => actionsRef.current!.close());
      await flushMicrotasks();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    });

    it('unmounts a positioner that has no popup', async () => {
      const { user } = render(() => (
        <Select.Root defaultOpen defaultValue="a">
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner data-testid="positioner">
              <Select.List>
                <Select.Item value="a">A</Select.Item>
              </Select.List>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      expect(screen.getByTestId('positioner')).not.toHaveAttribute('hidden');
      await user.click(screen.getByRole('option', { name: 'A' }));
      await flushMicrotasks();
      expect(screen.queryByTestId('positioner')).toBeNull();
    });

    it('keeps a positioner without a popup mounted when the close opts out', async () => {
      const { user } = render(() => (
        <Select.Root
          defaultOpen
          defaultValue="a"
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner data-testid="positioner">
              <Select.List>
                <Select.Item value="a">A</Select.Item>
              </Select.List>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await user.click(screen.getByRole('option', { name: 'A' }));
      await flushMicrotasks();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('positioner')).not.toHaveAttribute('hidden');
    });
  });

  describe('Navigation menu', () => {
    it('opens without recording an unmount opt-out', async () => {
      const { user } = render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content>Link</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup">
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Item 1' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await user.click(trigger);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('popup')).toBeTruthy();
    });

    it('finishes closing from the viewport when the popup element is absent', async () => {
      const actionsRef: { current: NavigationMenu.Root.Actions | null } = { current: null };
      const onOpenChangeComplete = vi.fn();
      render(() => (
        <NavigationMenu.Root
          defaultValue="item-1"
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
        >
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content>Link</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Viewport data-testid="viewport" />
        </NavigationMenu.Root>
      ));

      expect(screen.getByTestId('viewport')).toBeTruthy();
      act(() => actionsRef.current!.close());
      await flushMicrotasks();
      expect(screen.getByRole('button', { name: 'Item 1' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
    });

    it('stays mounted until unmount() when the close opts out', async () => {
      const actionsRef: { current: NavigationMenu.Root.Actions | null } = { current: null };
      render(() => (
        <NavigationMenu.Root
          defaultValue="item-1"
          actionsRef={actionsRef}
          onValueChange={(value, details) => {
            if (value == null) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content>Link</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup">
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));

      expect(screen.getByTestId('popup')).toBeTruthy();
      const trigger = screen.getByRole('button', { name: 'Item 1' });
      fireEvent.keyDown(trigger, { key: 'Escape' });
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('popup')).not.toBeNull();

      act(() => actionsRef.current?.unmount());
      flush();
      expect(screen.queryByTestId('popup')).toBeNull();
    });

    it('closes through the close action so onValueChange can opt out', async () => {
      const actionsRef: { current: NavigationMenu.Root.Actions | null } = { current: null };
      const onValueChange = vi.fn();
      render(() => (
        <NavigationMenu.Root
          defaultValue="item-1"
          actionsRef={actionsRef}
          onValueChange={onValueChange}
        >
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content>Link</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup">
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Item 1' });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      act(() => actionsRef.current!.close());
      await flushMicrotasks();
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBeNull();
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe('imperative-action');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps the opt-out when close runs again while the popup is closed', async () => {
      const actionsRef: { current: NavigationMenu.Root.Actions | null } = { current: null };
      const onOpenChangeComplete = vi.fn();
      render(() => (
        <NavigationMenu.Root
          defaultValue="item-1"
          actionsRef={actionsRef}
          onOpenChangeComplete={onOpenChangeComplete}
          onValueChange={(value, details) => {
            if (value == null) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content>Link</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup">
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));

      act(() => actionsRef.current!.close());
      await flushMicrotasks();
      act(() => actionsRef.current!.close());
      await flushMicrotasks();

      expect(screen.getByRole('button', { name: 'Item 1' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(screen.getByTestId('popup')).not.toBeNull();
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      act(() => actionsRef.current!.unmount());
      flush();
      expect(screen.queryByTestId('popup')).toBeNull();
      expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
    });
  });
});
