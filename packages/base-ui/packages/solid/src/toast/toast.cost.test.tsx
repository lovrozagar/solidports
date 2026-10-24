/* eslint-disable testing-library/no-container -- compares the rendered documents directly */
/*
 * One toast's parts against the hand-written floor (`test/floor/toast.tsx`, D32's sweep): Root,
 * Content, Title, Description and Close render on the native path with the floor's DOM, and the dev
 * runtime's reactive nodes each part adds stay at its native budget. Toast.Action stays on the slow
 * path: the toast's `actionProps` are a props source that can change with any update.
 */
import { createSignal, DEV, flush, For } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Toast } from '@solidports/base-ui/toast';
import { createRenderer, isJSDOM } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { normalizeTree } from '../../test/parityHarness';
import {
  FloorToastClose,
  FloorToastContent,
  FloorToastDescription,
  FloorToastRoot,
  FloorToastTitle,
} from '../../test/floor/toast';
import type { FloorToastData } from '../../test/floor/toast';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

/** Each part's count at D32's port; the slow path's in the comment. */
const BUDGET = {
  root: 15, // slow 32, floor 12
  content: 3, // slow 12, floor 3
  title: 11, // slow 24, floor 9
  description: 11, // slow 24, floor 9
  close: 3, // slow 12, floor 4
};

type Part = keyof typeof BUDGET;

describe('toast cost against the hand-written floor', () => {
  const { render } = createRenderer();

  const parts: Record<Part, () => JSX.Element> = {
    root: () => null,
    content: () => <Toast.Content />,
    title: () => <Toast.Title />,
    description: () => <Toast.Description />,
    close: () => <Toast.Close>Dismiss</Toast.Close>,
  };
  const floorParts: Record<Part, () => JSX.Element> = {
    root: () => null,
    content: () => <FloorToastContent />,
    title: () => <FloorToastTitle />,
    description: () => <FloorToastDescription />,
    close: () => <FloorToastClose>Dismiss</FloorToastClose>,
  };

  /** The nodes adding `n` toasts creates, each rendering `inner` in its root. */
  function libraryNodes(n: number, inner: () => JSX.Element) {
    const manager = Toast.createToastManager();
    function List() {
      const { toasts } = Toast.useToastManager();
      return (
        <For each={toasts()}>{(toast) => <Toast.Root toast={toast}>{inner()}</Toast.Root>}</For>
      );
    }
    const view = render(() => (
      <Toast.Provider toastManager={manager} timeout={0} limit={100}>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
      </Toast.Provider>
    ));
    flush();
    count = 0;
    hooks.onOwner = counting;
    for (let i = 0; i < n; i += 1) {
      manager.add({ title: `Title ${i}`, description: 'Description' });
    }
    flush();
    hooks.onOwner = undefined;
    const created = count;
    view.unmount();
    return created;
  }

  function floorNodes(n: number, inner: () => JSX.Element) {
    const [toasts, setToasts] = createSignal<FloorToastData[]>([]);
    const [expanded] = createSignal(false);
    const view = render(() => (
      <div>
        <For each={toasts()}>
          {(toast, index) => (
            <FloorToastRoot
              toast={toast}
              index={index}
              offsetY={() => 0}
              expanded={expanded}
              close={() => {}}
            >
              {inner()}
            </FloorToastRoot>
          )}
        </For>
      </div>
    ));
    flush();
    count = 0;
    hooks.onOwner = counting;
    for (let i = 0; i < n; i += 1) {
      setToasts((list) => [
        { id: `t${i}`, title: `Title ${i}`, description: 'Description' },
        ...list,
      ]);
      flush();
    }
    hooks.onOwner = undefined;
    const created = count;
    view.unmount();
    return created;
  }

  /** Nodes one more toast adds next to four. */
  const perToast = (nodes: (n: number) => number) => nodes(5) - nodes(4);
  const partCost = (part: Part) =>
    part === 'root'
      ? perToast((n) => libraryNodes(n, parts.root))
      : perToast((n) => libraryNodes(n, parts[part])) -
        perToast((n) => libraryNodes(n, parts.root));
  const floorCost = (part: Part) =>
    part === 'root'
      ? perToast((n) => floorNodes(n, floorParts.root))
      : perToast((n) => floorNodes(n, floorParts[part])) -
        perToast((n) => floorNodes(n, floorParts.root));

  // Solid: a browser measures the toast and writes its `--toast-height`, which the floor leaves out.
  it.skipIf(!isJSDOM)('the floor renders the same DOM as a toast', () => {
    const html = (ui: () => JSX.Element, after?: () => void) => {
      const view = render(ui);
      after?.();
      flush();
      const ids = new Map<string, string>();
      const tree = normalizeTree(view.container).replace(/mui-[0-9A-Za-z:-]+/g, (id) => {
        if (!ids.has(id)) {
          ids.set(id, `mui-#${ids.size}`);
        }
        return ids.get(id)!;
      });
      view.unmount();
      return tree;
    };
    const manager = Toast.createToastManager();
    function List() {
      const { toasts } = Toast.useToastManager();
      return (
        <For each={toasts()}>
          {(toast) => (
            <Toast.Root toast={toast}>
              <Toast.Content>
                <Toast.Title />
                <Toast.Description />
                <Toast.Close>Dismiss</Toast.Close>
              </Toast.Content>
            </Toast.Root>
          )}
        </For>
      );
    }
    const library = html(
      () => (
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
        </Toast.Provider>
      ),
      () => manager.add({ id: 't0', title: 'Title', description: 'Description' }),
    );
    const floor = html(() => (
      <div
        aria-atomic="false"
        aria-label="Notifications"
        aria-live="polite"
        aria-relevant="additions text"
        role="region"
        tabindex="-1"
      >
        <FloorToastRoot
          toast={{ id: 't0', title: 'Title', description: 'Description' }}
          index={() => 0}
          offsetY={() => 0}
          expanded={() => false}
          close={() => {}}
        >
          <FloorToastContent>
            <FloorToastTitle />
            <FloorToastDescription />
            <FloorToastClose>Dismiss</FloorToastClose>
          </FloorToastContent>
        </FloorToastRoot>
      </div>
    ));
    expect(floor).toBe(library);
  });

  it("a toast's parts render on the native path", () => {
    const manager = Toast.createToastManager();
    function List() {
      const { toasts } = Toast.useToastManager();
      return (
        <For each={toasts()}>
          {(toast) => (
            <Toast.Root toast={toast} data-testid="root">
              <Toast.Content data-testid="content">
                <Toast.Title data-testid="title" />
                <Toast.Description data-testid="description" />
                <Toast.Close data-testid="close">Dismiss</Toast.Close>
              </Toast.Content>
            </Toast.Root>
          )}
        </For>
      );
    }
    const view = render(() => (
      <Toast.Provider toastManager={manager} timeout={0}>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
      </Toast.Provider>
    ));
    manager.add({ title: 'Title', description: 'Description' });
    flush();
    const paths = Object.fromEntries(
      ['root', 'content', 'title', 'description', 'close'].map((name) => [
        name,
        renderPathOf(view.container.querySelector(`[data-testid="${name}"]`)!),
      ]),
    );
    expect(paths).toEqual({
      root: 'native',
      content: 'native',
      title: 'native',
      description: 'native',
      close: 'native',
    });
    view.unmount();
  });

  it.each(Object.keys(BUDGET) as Part[])('Toast %s costs at most its native budget', (part) => {
    const cost = partCost(part);
    expect(cost, `${part} ${cost} nodes, floor ${floorCost(part)}`).toBeLessThanOrEqual(
      BUDGET[part],
    );
  });
});

/** Toast.Arrow at D32's port; the slow path's in the comment. */
const ARROW_BUDGET = 2; // slow 14

describe('toast arrow cost', () => {
  const { render } = createRenderer();
  const anchored: Toast.Root.ToastObject = { id: 'anchored', title: 'Saved' };

  function nodes(ui: () => JSX.Element) {
    count = 0;
    hooks.onOwner = counting;
    const view = render(ui);
    flush();
    hooks.onOwner = undefined;
    const created = count;
    view.unmount();
    return created;
  }

  const arrows = (n: number) => () => (
    <Toast.Provider>
      <Toast.Positioner toast={anchored}>
        {Array.from({ length: n }, () => (
          <Toast.Arrow data-testid="arrow" />
        ))}
      </Toast.Positioner>
    </Toast.Provider>
  );

  it('a Toast.Arrow renders on the native path', () => {
    const view = render(arrows(1));
    flush();
    expect(renderPathOf(document.querySelector('[data-testid="arrow"]')!)).toBe('native');
    view.unmount();
  });

  it('a Toast.Arrow stays within its native budget', () => {
    const cost = nodes(arrows(5)) - nodes(arrows(4));
    expect(cost, `Toast.Arrow ${cost} nodes`).toBe(ARROW_BUDGET);
  });
});
