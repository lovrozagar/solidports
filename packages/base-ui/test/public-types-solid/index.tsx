import { omit, onSettled } from 'solid-js';
import { Menu } from '@solidports/base-ui/menu';
import { Toast } from '@solidports/base-ui/toast';
import type { CheckboxProps } from './checkbox';
import type { SeparatorProps } from './separator';
import type { SimpleAutocompleteProps } from './autocomplete';
import { AutocompleteHarness } from './autocomplete';
import type { SimpleComboboxProps } from './combobox';
import { ComboboxHarness } from './combobox';
import type {
  MenuRootActions,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  SimpleMenuProps,
} from './menu';
import type {
  ToastCreateManagerReturn,
  ToastManagerReturnValue,
  ToastManagerAddOptions,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
  ToastProviderProps,
} from './toast';

export function MyCheckbox(_props: CheckboxProps) {
  return <div />;
}

export function MySeparator(_props: SeparatorProps) {
  return <hr />;
}

export function SimpleCombobox(props: SimpleComboboxProps) {
  return <ComboboxHarness {...props} />;
}

export function SimpleAutocomplete(props: SimpleAutocompleteProps) {
  return <AutocompleteHarness {...props} />;
}

export function SimpleMenu(
  props: SimpleMenuProps & { ref?: (element: HTMLButtonElement | null) => void },
) {
  const rootProps = omit(props, 'label', 'ref');
  const actionsRef: { current: MenuRootActions | null } = { current: null };

  function handleMenuOpenChange(
    open: boolean,
    details: MenuRootChangeEventDetails,
  ): MenuRootChangeEventReason | undefined {
    void open;
    if (details.reason === 'trigger-hover') {
      return details.reason;
    }
    return undefined;
  }

  return (
    <Menu.Root {...rootProps} actionsRef={actionsRef} onOpenChange={handleMenuOpenChange}>
      <Menu.Trigger ref={props.ref}>{props.label ?? 'Menu'}</Menu.Trigger>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Item>Item 1</Menu.Item>
          <Menu.Item>Item 2</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Root>
  );
}

function exerciseToastManager(manager: ToastManagerReturnValue) {
  const id = manager.add({ title: 'Toast', description: 'Created' });
  manager.update(id, { description: 'Updated description', timeout: 4000 });
  const promiseOptions: ToastManagerPromiseOptions<string, { info: string }> = {
    loading: { description: 'Loading…', data: { info: 'loading' } },
    success: (value) => ({ description: value, data: { info: value } }),
    error: (error) => ({ description: String(error), data: { info: 'failed' } }),
  };

  void manager.promise(Promise.resolve('done'), promiseOptions);
  manager.close(id);
}

export function ToastHarness(props: ToastProviderProps) {
  const externalManager: ToastCreateManagerReturn = Toast.createToastManager();

  onSettled(() => {
    const addOptions: ToastManagerAddOptions<{ details: string }> = {
      title: 'External toast',
      description: 'Created via external manager',
      data: { details: 'payload' },
    };
    const toastId = externalManager.add(addOptions);

    const updateOptions: ToastManagerUpdateOptions<{ details: string }> = {
      description: 'Updated externally',
      data: { details: 'updated' },
    };
    externalManager.update(toastId, updateOptions);

    const externalPromiseOptions: ToastManagerPromiseOptions<string, { details: string }> = {
      loading: { description: 'Loading external…', data: { details: 'loading' } },
      success: (value) => ({ description: value, data: { details: value } }),
      error: (error) => ({ description: String(error), data: { details: 'error' } }),
    };
    void externalManager.promise(Promise.resolve('value'), externalPromiseOptions);
  });

  return (
    <Toast.Provider {...props} toastManager={externalManager}>
      <Toast.Viewport />
      <ToastUsage />
    </Toast.Provider>
  );
}

function ToastUsage() {
  const manager = Toast.useToastManager();

  onSettled(() => {
    exerciseToastManager(manager);
  });

  return null;
}
