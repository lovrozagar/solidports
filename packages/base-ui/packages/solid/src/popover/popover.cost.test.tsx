/*
 * A closed Popover's trigger against the hand-written floor (`test/floor/popover.tsx`, D32's
 * sweep): the trigger renders on the native path with the floor's DOM, and the dev runtime's
 * reactive nodes one more closed trigger adds stay at the native trigger's count. The floor ratio is
 * the exit bar's target (D32 puts it after the sweep): what remains is the trigger's shared popup
 * machinery (data forwarding, focus guards, deferred interactions) and Popover.Root's store.
 */
import { DEV, flush, For } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Popover } from '@solidports/base-ui/popover';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { handleTreeCost } from '../../test/handleTriggerCost';
import { normalizeTree } from '../../test/parityHarness';
import { FloorPopoverRoot, FloorPopoverTrigger } from '../../test/floor/popover';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

/** The native trigger's count at D32's port (24 on the slow trigger's 38). */
const TRIGGER_BUDGET = 24;

describe('popover cost against the hand-written floor', () => {
  const { render } = createRenderer();

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

  /** Nodes one more copy of `shape` adds next to four. */
  const perCopy = (shape: () => JSX.Element) =>
    nodes(() => Array.from({ length: 5 }, shape)) - nodes(() => Array.from({ length: 4 }, shape));

  const part = {
    root: () => <Popover.Root />,
    rootTrigger: () => (
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
      </Popover.Root>
    ),
  };
  const floor = {
    root: () => <FloorPopoverRoot />,
    rootTrigger: () => (
      <FloorPopoverRoot>
        <FloorPopoverTrigger>Open</FloorPopoverTrigger>
      </FloorPopoverRoot>
    ),
  };

  it('the floor renders the same DOM as a closed Popover.Trigger', () => {
    const html = (ui: () => JSX.Element) => {
      const view = render(ui);
      flush();
      const tree = normalizeTree(view.container);
      view.unmount();
      return tree;
    };
    expect(html(floor.rootTrigger)).toBe(html(part.rootTrigger));
  });

  it('a closed Popover.Trigger renders on the native path', () => {
    const view = render(part.rootTrigger);
    flush();
    expect(renderPathOf(screen.getByRole('button'))).toBe('native');
    view.unmount();
  });

  it('a closed Popover.Trigger costs at most the native trigger budget', () => {
    const cost = perCopy(part.rootTrigger) - perCopy(part.root);
    const floorCost = perCopy(floor.rootTrigger) - perCopy(floor.root);
    expect(cost, `closed Popover.Trigger ${cost} nodes, floor ${floorCost}`).toBeLessThanOrEqual(
      TRIGGER_BUDGET,
    );
  });
});

/**
 * Detached-handle triggers render on the slow path. The whole tree (the root and five triggers
 * sharing its handle) costs at most base's (44260fef, before D32's native Popover.Trigger) at mount
 * and after the last trigger's first press (regate c): a per-trigger count missed work moving
 * between the root and its triggers.
 */
const HANDLE_TREE_BUDGET = { mount: 281, total: 526 };

function handleTree() {
  const handle = Popover.createHandle();
  return () => (
    <div>
      <For each={[0, 1, 2, 3, 4]}>
        {(i) => (
          <Popover.Trigger data-testid="handle-trigger" handle={handle}>
            Trigger {i}
          </Popover.Trigger>
        )}
      </For>
      <Popover.Root handle={handle}>
        <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Popup</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function firstIntent(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
}

describe('detached-handle Popover.Trigger cost', () => {
  const { render } = createRenderer();

  it('renders on the slow path', () => {
    const handle = Popover.createHandle();
    const view = render(() => (
      <Popover.Trigger data-testid="handle-trigger" handle={handle}>
        Trigger
      </Popover.Trigger>
    ));
    flush();
    expect(renderPathOf(screen.getByTestId('handle-trigger'))).toBe('slow');
    view.unmount();
  });

  it('costs at most base at mount and after the first press, as a whole tree', async () => {
    const cost = await handleTreeCost(render, handleTree(), firstIntent);
    expect(cost.mount, `mount ${cost.mount}`).toBeLessThanOrEqual(HANDLE_TREE_BUDGET.mount);
    expect(cost.total, `after the first press ${cost.total}`).toBeLessThanOrEqual(
      HANDLE_TREE_BUDGET.total,
    );
  });
});
