import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { ContextMenu } from '@base-ui/react/context-menu';
import { Menubar } from '@base-ui/react/menubar';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const popupStyle = { maxHeight: '300px', overflow: 'auto' } as const;

const menuItems = items(size(500));
function Menu500() {
  const open = useExposed('open', false);
  return (
    <Menu.Root open={open} onOpenChange={setExposed('open')}>
      <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup style={popupStyle}>
            {menuItems.map((it) => (
              <Menu.Item key={it.value}>{it.label}</Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const checkItems = items(size(100));
function CheckboxRadio() {
  const open = useExposed('open', false);
  const [radio, setRadio] = React.useState('item-0');
  return (
    <Menu.Root open={open} onOpenChange={setExposed('open')}>
      <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup style={popupStyle}>
            {checkItems.map((it) => (
              <Menu.CheckboxItem key={it.value} data-kind="check" closeOnClick={false}>
                <Menu.CheckboxItemIndicator>✓</Menu.CheckboxItemIndicator>
                {it.label}
              </Menu.CheckboxItem>
            ))}
            <Menu.RadioGroup value={radio} onValueChange={setRadio}>
              {checkItems.map((it) => (
                <Menu.RadioItem
                  key={it.value}
                  value={it.value}
                  data-kind="radio"
                  closeOnClick={false}
                >
                  <Menu.RadioItemIndicator>•</Menu.RadioItemIndicator>
                  Radio {it.label}
                </Menu.RadioItem>
              ))}
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
            {leaf.map((it) => (
              <Menu.Item key={it.value}>
                {props.label} {it.label}
              </Menu.Item>
            ))}
            {props.depth < 3 ? (
              <Submenu label={`${props.label}.${props.depth + 1}`} depth={props.depth + 1} />
            ) : null}
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
    <Menu.Root open={open} onOpenChange={setExposed('open')}>
      <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            {subRoots.map((it) => (
              <Submenu key={it.value} label={`Sub ${it.value}`} depth={1} />
            ))}
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
      {manyRoots.map((it) => (
        <Menu.Root key={it.value}>
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
      ))}
    </div>
  );
}

const targets = items(size(200));
const contextItems = items(20);
function ContextMenus() {
  return (
    <div>
      {targets.map((it) => (
        <ContextMenu.Root key={it.value}>
          <ContextMenu.Trigger data-target={it.value} style={{ height: '8px' }}>
            {it.label}
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup>
                {contextItems.map((entry) => (
                  <ContextMenu.Item key={entry.value}>
                    {it.label} {entry.label}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      ))}
    </div>
  );
}

const bar = items(10);
const barItems = items(size(50));
function Menubar10() {
  return (
    <Menubar>
      {bar.map((menu) => (
        <Menu.Root key={menu.value}>
          <Menu.Trigger data-bar={menu.value}>{menu.label}</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup style={popupStyle}>
                {barItems.map((it) => (
                  <Menu.Item key={it.value}>
                    {menu.label} {it.label}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ))}
    </Menubar>
  );
}

const navItems = items(8);
const navLinks = items(size(100));
function Navigation() {
  return (
    <NavigationMenu.Root delay={0} closeDelay={0}>
      <NavigationMenu.List>
        {navItems.map((nav) => (
          <NavigationMenu.Item key={nav.value}>
            <NavigationMenu.Trigger data-nav={nav.value}>{nav.label}</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <ul>
                {navLinks.map((link) => (
                  <li key={link.value}>
                    <NavigationMenu.Link href={`#${nav.value}-${link.value}`}>
                      {nav.label} {link.label}
                    </NavigationMenu.Link>
                  </li>
                ))}
              </ul>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        ))}
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

export const fixtures: Record<string, React.FC> = {
  'menu/500': Menu500,
  'menu/checkbox-radio': CheckboxRadio,
  'menu/submenus': Submenus,
  'menu/many-roots': ManyRoots,
  'context-menu/200': ContextMenus,
  'menubar/10x50': Menubar10,
  'navigation-menu/8x100': Navigation,
};
