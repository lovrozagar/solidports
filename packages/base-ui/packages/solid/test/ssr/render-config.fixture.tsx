import { renderToString } from '@solidjs/web';
import { Button } from '@solidports/base-ui/button';
import { Menu } from '@solidports/base-ui/menu';
import { Toolbar } from '@solidports/base-ui/toolbar';

/*
 * A `{ component, ...props }` render config is the Solid counterpart of a render element. The
 * server has no DOM: telling a config from a DOM node must not reach for `Node`.
 */
export function render(): string {
  return renderToString(() => (
    <>
      <Button render={{ component: 'a', href: '/docs', children: 'Docs' }} nativeButton={false} />
      <Menu.Root>
        <Menu.Trigger render={{ component: 'button', id: 'menu-trigger', class: 'Trigger' }}>
          Open
        </Menu.Trigger>
      </Menu.Root>
      <Toolbar.Root>
        <Toolbar.Button render={{ component: 'span', 'data-kind': 'tool' }} nativeButton={false}>
          Tool
        </Toolbar.Button>
      </Toolbar.Root>
    </>
  ));
}
