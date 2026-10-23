/*
 * A part may receive its `ref` as a getter with no setter: a props object built from another's
 * descriptors, as a merged or forwarded props object is (and as the parity harness builds one).
 * Solid's compiler already resolves a component's `ref={x}` to a function at the call site, so a
 * part never writes a ref back to its props: NavigationMenu.Link and List and Menubar did
 * (`props.ref = el`), which threw on a getter-only `ref` and halted the reactive system.
 */
import { createComponent, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { describe, expect, it } from 'vitest';
import { Menubar } from '@solidports/base-ui/menubar';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { createRenderer } from '#test-utils';

type Ref = ((el: HTMLElement) => void) | undefined;

/** `Component` with `props` and a getter-only `ref` that returns `ref`. */
function withGetterRef<P extends object>(
  Component: (props: P) => JSX.Element,
  props: P,
  ref: Ref,
): JSX.Element {
  const merged = Object.defineProperties({}, Object.getOwnPropertyDescriptors(props));
  Object.defineProperty(merged, 'ref', { get: () => ref, enumerable: true, configurable: true });
  return createComponent(Component, merged as P);
}

function OpenNavigationMenu(props: {
  list: (children: () => JSX.Element) => JSX.Element;
  link?: JSX.Element;
}) {
  return (
    <NavigationMenu.Root defaultValue="a">
      {props.list(() => (
        <NavigationMenu.Item value="a">
          <NavigationMenu.Trigger>a</NavigationMenu.Trigger>
          <NavigationMenu.Content>{props.link}</NavigationMenu.Content>
        </NavigationMenu.Item>
      ))}
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

const plainList = (children: () => JSX.Element) => (
  <NavigationMenu.List>{children()}</NavigationMenu.List>
);

const sites: Record<string, (ref: Ref) => JSX.Element> = {
  'NavigationMenu.Link': (ref) => (
    <OpenNavigationMenu
      list={plainList}
      link={withGetterRef(
        NavigationMenu.Link,
        { href: '#a', 'data-testid': 'part', children: 'Link' } as NavigationMenu.Link.Props,
        ref,
      )}
    />
  ),
  'NavigationMenu.List': (ref) => (
    <OpenNavigationMenu
      list={(children) =>
        withGetterRef(
          NavigationMenu.List,
          {
            'data-testid': 'part',
            get children() {
              return children();
            },
          } as NavigationMenu.List.Props,
          ref,
        )
      }
    />
  ),
  Menubar: (ref) => withGetterRef(Menubar, { 'data-testid': 'part' } as Menubar.Props, ref),
};

describe('a part given a getter-only ref', () => {
  const { render } = createRenderer();

  describe.each(Object.keys(sites))('%s', (name) => {
    it('renders when the ref is undefined, and a function ref receives the element', () => {
      const view = render(() => sites[name](undefined));
      flush();
      expect(document.querySelector('[data-testid="part"]')).not.toBe(null);
      view.unmount();

      let received: HTMLElement | null = null;
      render(() =>
        sites[name]((el) => {
          received = el;
        }),
      );
      flush();
      expect(received).not.toBe(null);
      expect(received!.getAttribute('data-testid')).toBe('part');
    });
  });
});
