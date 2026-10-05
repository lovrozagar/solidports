import { createSignal, For, Show } from 'solid-js';
import { Menu } from '@solidports/base-ui/menu';
import { ContextMenu } from '@solidports/base-ui/context-menu';
import { Menubar } from '@solidports/base-ui/menubar';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const popupStyle = { 'max-height': '300px', overflow: 'auto' } as const;

const menuItems = items(size(500));
function Menu500() {
  const open = useExposed('open', false);
  return (
    <Menu.Root open={open()} onOpenChange={setExposed('open')}>
      <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup style={popupStyle}>
            <For each={menuItems}>{(it) => <Menu.Item>{it.label}</Menu.Item>}</For>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const checkItems = items(size(100));
function CheckboxRadio() {
  const open = useExposed('open', false);
  const [radio, setRadio] = createSignal('item-0');
  return (
    <Menu.Root open={open()} onOpenChange={setExposed('open')}>
      <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup style={popupStyle}>
            <For each={checkItems}>
              {(it) => (
                <Menu.CheckboxItem data-kind="check" closeOnClick={false}>
                  <Menu.CheckboxItemIndicator>✓</Menu.CheckboxItemIndicator>
                  {it.label}
                </Menu.CheckboxItem>
              )}
            </For>
            <Menu.RadioGroup value={radio()} onValueChange={(value) => setRadio(value as string)}>
              <For each={checkItems}>
                {(it) => (
                  <Menu.RadioItem value={it.value} data-kind="radio" closeOnClick={false}>
                    <Menu.RadioItemIndicator>•</Menu.RadioItemIndicator>
                    Radio {it.label}
                  </Menu.RadioItem>
                )}
              </For>
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const leaf = items(10);
function Submenu(props: { label: string; depth: number }) {
  return (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger delay={0} closeDelay={0} data-level={props.depth}>
        {props.label}
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <For each={leaf}>
              {(it) => (
                <Menu.Item>
                  {props.label} {it.label}
                </Menu.Item>
              )}
            </For>
            <Show when={props.depth < 3}>
              <Submenu label={`${props.label}.${props.depth + 1}`} depth={props.depth + 1} />
            </Show>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
}

const subRoots = items(size(20));
function Submenus() {
  const open = useExposed('open', false);
  return (
    <Menu.Root open={open()} onOpenChange={setExposed('open')}>
      <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <For each={subRoots}>{(it) => <Submenu label={`Sub ${it.value}`} depth={1} />}</For>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const manyRoots = items(size(500));
function ManyRoots() {
  return (
    <div>
      <For each={manyRoots}>
        {(it) => (
          <Menu.Root>
            <Menu.Trigger>{it.label}</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>One</Menu.Item>
                  <Menu.Item>Two</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </For>
    </div>
  );
}

const targets = items(size(200));
const contextItems = items(20);
function ContextMenus() {
  return (
    <div>
      <For each={targets}>
        {(it) => (
          <ContextMenu.Root>
            <ContextMenu.Trigger data-target={it.value} style={{ height: '8px' }}>
              {it.label}
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Positioner>
                <ContextMenu.Popup>
                  <For each={contextItems}>
                    {(entry) => (
                      <ContextMenu.Item>
                        {it.label} {entry.label}
                      </ContextMenu.Item>
                    )}
                  </For>
                </ContextMenu.Popup>
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        )}
      </For>
    </div>
  );
}

const bar = items(10);
const barItems = items(size(50));
function Menubar10() {
  return (
    <Menubar>
      <For each={bar}>
        {(menu) => (
          <Menu.Root>
            <Menu.Trigger data-bar={menu.value}>{menu.label}</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup style={popupStyle}>
                  <For each={barItems}>
                    {(it) => (
                      <Menu.Item>
                        {menu.label} {it.label}
                      </Menu.Item>
                    )}
                  </For>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </For>
    </Menubar>
  );
}

const navItems = items(8);
const navLinks = items(size(100));
function Navigation() {
  return (
    <NavigationMenu.Root delay={0} closeDelay={0}>
      <NavigationMenu.List>
        <For each={navItems}>
          {(nav) => (
            <NavigationMenu.Item>
              <NavigationMenu.Trigger data-nav={nav.value}>{nav.label}</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <ul>
                  <For each={navLinks}>
                    {(link) => (
                      <li>
                        <NavigationMenu.Link href={`#${nav.value}-${link.value}`}>
                          {nav.label} {link.label}
                        </NavigationMenu.Link>
                      </li>
                    )}
                  </For>
                </ul>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          )}
        </For>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'menu/500': Menu500,
  'menu/checkbox-radio': CheckboxRadio,
  'menu/submenus': Submenus,
  'menu/many-roots': ManyRoots,
  'context-menu/200': ContextMenus,
  'menubar/10x50': Menubar10,
  'navigation-menu/8x100': Navigation,
};
