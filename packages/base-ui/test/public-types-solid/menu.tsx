import { createSignal } from 'solid-js';
import { Menu, MenuClearDataAttributes, MenuInputDataAttributes } from '@solidports/base-ui/menu';

export type MenuRootProps = Menu.Root.Props;
export type MenuRootActions = Menu.Root.Actions;
export type MenuRootChangeEventReason = Menu.Root.ChangeEventReason;
export type MenuRootChangeEventDetails = Menu.Root.ChangeEventDetails;
export type MenuRootOrientation = Menu.Root.Orientation;
export type MenuRootHighlightEventReason = Menu.Root.HighlightEventReason;
export type MenuRootHighlightEventDetails = Menu.Root.HighlightEventDetails;

export function HighlightedItemLabel() {
  const [label, setLabel] = createSignal<string | undefined>();
  return (
    <Menu.Root
      onItemHighlighted={(item, details) => {
        setLabel(item ? details.label : undefined);
        // @ts-expect-error the reason set is closed
        return details.reason === 'focus';
      }}
    >
      {label()}
    </Menu.Root>
  );
}

export interface SimpleMenuProps extends Omit<MenuRootProps, 'children'> {
  label?: string;
}

export function InternalSubmenuPropsStayHidden() {
  // @ts-expect-error virtual focus is internal to the filterable menu
  return <Menu.SubmenuRoot virtualFocus />;
}

const filterHandle = Menu.createHandle<{ id: number }>();

export function TypedFilterableTrigger() {
  return (
    <>
      <Menu.FilterProvider>
        <Menu.Root handle={filterHandle}>{({ payload }) => <span>{payload?.id}</span>}</Menu.Root>
      </Menu.FilterProvider>
      <Menu.Trigger handle={filterHandle} payload={{ id: 1 }}>
        Open
      </Menu.Trigger>
      {/* @ts-expect-error the payload must match the handle */}
      <Menu.Trigger handle={filterHandle} payload="wrong">
        Invalid
      </Menu.Trigger>
    </>
  );
}

export type MenuFilterFunction = Menu.FilterProvider.Props['filter'];
export type MenuFilterChangeEventReason = Menu.FilterProvider.ChangeEventReason;
export type MenuFilterChangeEventDetails = Menu.FilterProvider.ChangeEventDetails;
export type MenuFilterUtils = ReturnType<typeof Menu.useFilter>;
export type MenuFilterProviderState = Menu.FilterProvider.State;

export function FilterableMenuParts() {
  const [value, setValue] = createSignal('');
  const { contains }: MenuFilterUtils = Menu.useFilter({ sensitivity: 'base' });
  const linkRef: { current: Element | null } = { current: null };
  const inputRef: { current: HTMLInputElement | null } = { current: null };
  const clearRef: { current: HTMLButtonElement | null } = { current: null };
  const emptyRef: { current: HTMLDivElement | null } = { current: null };
  const listRef: { current: HTMLDivElement | null } = { current: null };

  return (
    <Menu.FilterProvider
      value={value()}
      onValueChange={(nextValue, eventDetails: MenuFilterChangeEventDetails) => {
        const reason: MenuFilterChangeEventReason = eventDetails.reason;
        if (reason === 'popup-close') {
          eventDetails.cancel();
          return;
        }
        setValue(nextValue);
      }}
      filter={(text, query) => contains(text, query)}
      autoHighlight="always"
    >
      <Menu.Root>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input
                ref={inputRef}
                class={(state: Menu.Input.State) => (state.highlighted ? 'ring' : '')}
              />
              <Menu.Clear
                ref={clearRef}
              />
              <Menu.Empty
                ref={emptyRef}
              >
                No actions
              </Menu.Empty>
              <Menu.List
                ref={listRef}
              >
                <Menu.Item label="Rename">Rename</Menu.Item>
                <Menu.LinkItem
                  ref={linkRef}
                  href="#settings"
                >
                  Settings
                </Menu.LinkItem>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

export function SubmenuHighlightDetails() {
  return (
    <Menu.Root>
      <Menu.SubmenuRoot
        onItemHighlighted={(item, details: Menu.Root.HighlightEventDetails) => {
          const event: Event = details.event;
          return [item, event, details.label];
        }}
      />
    </Menu.Root>
  );
}

export const inputHighlighted: 'data-highlighted' = MenuInputDataAttributes.highlighted;
export const clearDisabled: 'data-disabled' = MenuClearDataAttributes.disabled;
