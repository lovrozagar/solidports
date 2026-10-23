/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Parity for the NavigationMenu parts D32's sweep put on the native path (Item, Icon and Link):
 * one menu renders through the native paths, then, alone, with those parts forced onto the slow
 * path (`part`), and the two must produce the same normalized document, and the same focused
 * element, after each step: opening an item by a controlled value, toggling a link's `active`,
 * hovering, focusing and blurring links, closing on a link click, and three reopens of a content
 * that unmounts while closed, after which its list holds each link once.
 */
import { createSignal, flush, onCleanup } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { act, createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { useCompositeListContext } from '../internals/composite/list/CompositeListContext';
import { normalizeTree, part } from '../../test/parityHarness';
import { renderPathOf } from '../utils/renderPath';

type Step = () => void;

/** The content's composite list as the latest map change left it. */
const registered = { size: -1, connected: true };

/** Renders nothing; records the size of its list's element map and whether every element is in the document. */
function ListProbe() {
  const list = useCompositeListContext();
  const unsubscribe = list.subscribeMapChange((map) => {
    registered.size = map.size;
    registered.connected = [...map.keys()].every((el) => el.isConnected);
  });
  onCleanup(unsubscribe);
  return null;
}

const link = (label: string) =>
  document.querySelectorAll<HTMLAnchorElement>(`a[data-label="${label}"]`)[0];

describe('native parity: navigation menu items, icons and links', () => {
  const { render } = createRenderer();

  function snapshots(slow: boolean, steps: (controls: Controls) => Step[]) {
    const [value, setValue] = createSignal<string | null>(null);
    const [active, setActive] = createSignal(false);
    const links = (item: string) =>
      ['one', 'two', 'three'].map((name) =>
        part(NavigationMenu.Link, slow, 'a', {
          href: `#${item}-${name}`,
          'data-label': `${item}-${name}`,
          closeOnClick: name === 'three',
          get active() {
            return name === 'one' && active();
          },
          children: name,
        }),
      );
    const item = (name: string) =>
      part(NavigationMenu.Item, slow, 'li', {
        value: name,
        get children() {
          return [
            <NavigationMenu.Trigger data-testid={`trigger-${name}`}>
              {name}
              {part(NavigationMenu.Icon, slow, 'span', {})}
            </NavigationMenu.Trigger>,
            <NavigationMenu.Content>
              {links(name)}
              <ListProbe />
            </NavigationMenu.Content>,
          ];
        },
      });
    const view = render(() => (
      <NavigationMenu.Root
        value={value()}
        onValueChange={(next: unknown) => setValue(next as string | null)}
      >
        <NavigationMenu.List>{[item('a'), item('b')]}</NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ));
    flush();
    const controls: Controls = { setValue, setActive };
    const record = () => {
      // Each tree took the path it stands for.
      const paths = [...document.body.querySelectorAll('li, span[aria-hidden], a')]
        .map((el) => renderPathOf(el))
        .filter(Boolean);
      expect(paths).not.toContain(slow ? 'native' : 'slow');
      const focused = document.activeElement;
      return {
        // The portal's `aria-owns` id comes from a global counter that runs on between the runs.
        tree: normalizeTree(document.body).replace(/mui-cl-\d+/g, 'mui-cl-#'),
        focused: focused?.getAttribute('data-label') ?? focused?.getAttribute('data-testid') ?? null,
      };
    };
    const trees = [record()];
    for (const step of steps(controls)) {
      step();
      flush();
      trees.push(record());
    }
    view.unmount();
    // The snapshot reads the whole body (the content renders in a portal): drop this run's
    // container so the next run's body starts the same.
    view.container.remove();
    return trees;
  }

  interface Controls {
    setValue: (value: string | null) => void;
    setActive: (active: boolean) => void;
  }

  it('Item, Icon and Link render the same DOM and focus through a full session', () => {
    const steps = ({ setValue, setActive }: Controls): Step[] => [
      () => setValue('a'),
      () => setActive(true),
      () => fireEvent.mouseMove(link('a-two')),
      () => link('a-one').focus(),
      () => fireEvent.blur(link('a-one')),
      () => setActive(false),
      () => setValue('b'),
      () => fireEvent.click(link('b-three')),
      () => setValue('a'),
      () => setValue(null),
      () => setValue('a'),
      () => setValue(null),
      () => setValue('a'),
    ];
    const native = snapshots(false, steps);
    // After the third open the content's list holds its three links once each, all in the document.
    expect(registered).toEqual({ size: 3, connected: true });
    registered.size = -1;
    expect(snapshots(true, steps)).toEqual(native);
    expect(registered).toEqual({ size: 3, connected: true });
  });
});

describe('native parity: arrow keys across navigation menu links', () => {
  const { render } = createRenderer();

  /**
   * Opens item `a` by its trigger, walks its three links with the arrow keys, then closes and
   * reopens it twice and walks them again: the focused link after each key, on one path.
   */
  async function walk(slow: boolean) {
    const [value, setValue] = createSignal<string | null>(null);
    // Created inside the content, under its composite list.
    const links = () =>
      ['one', 'two', 'three'].map((name) =>
        part(NavigationMenu.Link, slow, 'a', {
          href: `#a-${name}`,
          'data-label': `a-${name}`,
          children: name,
        }),
      );
    const view = await render(() => (
      <NavigationMenu.Root
        value={value()}
        onValueChange={(next: unknown) => setValue(next as string | null)}
      >
        <NavigationMenu.List>
          {part(NavigationMenu.Item, slow, 'li', {
            value: 'a',
            get children() {
              return [
                <NavigationMenu.Trigger data-testid="trigger-a">a</NavigationMenu.Trigger>,
                <NavigationMenu.Content>{links()}</NavigationMenu.Content>,
              ];
            },
          })}
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ));
    const focused = () => document.activeElement?.getAttribute('data-label') ?? null;
    const visited: (string | null)[] = [];
    async function arrows() {
      // The links took the path this run stands for.
      const paths = ['a-one', 'a-two', 'a-three'].map((label) => renderPathOf(link(label)));
      expect(paths).toEqual(Array(3).fill(slow ? 'slow' : 'native'));
      await act(async () => link('a-one').focus());
      visited.push(focused());
      for (const key of ['{ArrowDown}', '{ArrowDown}', '{ArrowUp}']) {
        // eslint-disable-next-line no-await-in-loop -- the keys run in order
        await view.user.keyboard(key);
        visited.push(focused());
      }
    }
    await act(async () => setValue('a'));
    await arrows();
    for (let i = 0; i < 2; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- each reopen follows the close
      await act(async () => setValue(null));
      // eslint-disable-next-line no-await-in-loop
      await act(async () => setValue('a'));
    }
    await arrows();
    view.unmount();
    view.container.remove();
    return visited;
  }

  it('moves focus across the links in order, before and after two reopens', async () => {
    const order = ['a-one', 'a-two', 'a-three', 'a-two'];
    const native = await walk(false);
    expect(native).toEqual([...order, ...order]);
    expect(await walk(true)).toEqual(native);
  });
});

describe('a native NavigationMenu.Link render prop', () => {
  const { render } = createRenderer();

  function mountLink(link: () => JSX.Element) {
    const view = render(() => (
      <NavigationMenu.Root defaultValue="a">
        <NavigationMenu.List>
          <NavigationMenu.Item value="a">
            <NavigationMenu.Trigger>a</NavigationMenu.Trigger>
            <NavigationMenu.Content>{link()}</NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ));
    flush();
    const el = document.querySelector('[data-label="link"]')!;
    const wrapper = document.createElement('div');
    wrapper.append(el.cloneNode(true));
    const result = { path: renderPathOf(el), html: normalizeTree(wrapper) };
    view.unmount();
    return result;
  }

  const tagForm = 'a';
  const configForm = { component: 'a', 'data-config': '' };
  const fnForm = (props: Record<string, unknown>) => <a {...props} data-fn="" />;
  const forms = { tag: tagForm, config: configForm, fn: fnForm };

  // Each native case passes an identifier, which compiles to a static prop.
  const native = {
    tag: () => (
      <NavigationMenu.Link href="#x" data-label="link" active render={tagForm}>
        Link
      </NavigationMenu.Link>
    ),
    config: () => (
      <NavigationMenu.Link href="#x" data-label="link" active render={configForm as never}>
        Link
      </NavigationMenu.Link>
    ),
    fn: () => (
      <NavigationMenu.Link href="#x" data-label="link" active render={fnForm as never}>
        Link
      </NavigationMenu.Link>
    ),
  };

  it.each(Object.keys(forms) as (keyof typeof forms)[])(
    'renders the %s form natively, as the slow path does',
    (form) => {
      const { path: nativePath, html: nativeHtml } = mountLink(native[form]);
      const { path: slowPath, html: slowHtml } = mountLink(() =>
        part(NavigationMenu.Link, true, 'a', {
          href: '#x',
          'data-label': 'link',
          active: true,
          render: forms[form] as never,
          children: 'Link',
        }),
      );
      expect(nativePath).toBe('native');
      expect(slowPath).toBe('slow');
      expect(nativeHtml).toBe(slowHtml);
    },
  );

  it('keeps a member-expression render, which compiles to a getter, on the slow path', () => {
    const { path } = mountLink(() => (
      <NavigationMenu.Link href="#x" data-label="link" render={forms.fn as never}>
        Link
      </NavigationMenu.Link>
    ));
    expect(path).toBe('slow');
  });
});
