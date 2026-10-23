/*
 * A closed PreviewCard's trigger against the hand-written floor (`test/floor/previewCard.tsx`, D32's
 * sweep): the trigger renders on the native path with the floor's DOM, and the dev runtime's
 * reactive nodes one more closed trigger adds stay at the native trigger's count. The floor ratio is
 * the exit bar's target (D32 puts it after the sweep): what remains is the trigger's shared popup
 * machinery (data forwarding, deferred interactions) and PreviewCard.Root's store.
 */
import { DEV, flush, For } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { handleTreeCost } from '../../test/handleTriggerCost';
import { normalizeTree } from '../../test/parityHarness';
import { FloorPreviewCardRoot, FloorPreviewCardTrigger } from '../../test/floor/previewCard';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

/** The native trigger's count at D32's port (23 on the slow trigger). */
const TRIGGER_BUDGET = 12;

describe('preview card cost against the hand-written floor', () => {
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
    root: () => <PreviewCard.Root />,
    rootTrigger: () => (
      <PreviewCard.Root>
        <PreviewCard.Trigger>Open</PreviewCard.Trigger>
      </PreviewCard.Root>
    ),
  };
  const floor = {
    root: () => <FloorPreviewCardRoot />,
    rootTrigger: () => (
      <FloorPreviewCardRoot>
        <FloorPreviewCardTrigger>Open</FloorPreviewCardTrigger>
      </FloorPreviewCardRoot>
    ),
  };

  it('the floor renders the same DOM as a closed PreviewCard.Trigger', () => {
    const html = (ui: () => JSX.Element) => {
      const view = render(ui);
      flush();
      const tree = normalizeTree(view.container);
      view.unmount();
      return tree;
    };
    expect(html(floor.rootTrigger)).toBe(html(part.rootTrigger));
  });

  it('a closed PreviewCard.Trigger renders on the native path', () => {
    const view = render(part.rootTrigger);
    flush();
    expect(renderPathOf(screen.getByText('Open'))).toBe('native');
    view.unmount();
  });

  it('a closed PreviewCard.Trigger costs at most the native trigger budget', () => {
    const cost = perCopy(part.rootTrigger) - perCopy(part.root);
    const floorCost = perCopy(floor.rootTrigger) - perCopy(floor.root);
    expect(cost, `closed PreviewCard.Trigger ${cost} nodes, floor ${floorCost}`).toBeLessThanOrEqual(
      TRIGGER_BUDGET,
    );
  });
});

/**
 * Detached-handle triggers render on the slow path. The whole tree (the root and five triggers
 * sharing its handle) costs at most base's (44260fef, before D32's native PreviewCard.Trigger) at mount
 * and after the last trigger's first hover (regate c): a per-trigger count missed work moving
 * between the root and its triggers.
 */
/** Ratcheted to the count after D32's sweep; D32's bar is base's 215 / 223. */
const HANDLE_TREE_BUDGET = { mount: 204, total: 212 };

function handleTree() {
  const handle = PreviewCard.createHandle();
  return () => (
    <div>
      <For each={[0, 1, 2, 3, 4]}>
        {(i) => (
          <PreviewCard.Trigger data-testid="handle-trigger" href="#a" handle={handle}>
            Trigger {i}
          </PreviewCard.Trigger>
        )}
      </For>
      <PreviewCard.Root handle={handle}>
        <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>Card</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
      </PreviewCard.Root>
    </div>
  );
}

function firstIntent(trigger: HTMLElement) {
  fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
  fireEvent.mouseEnter(trigger);
  fireEvent.focus(trigger);
}

describe('detached-handle PreviewCard.Trigger cost', () => {
  const { render } = createRenderer();

  it('renders on the slow path', () => {
    const handle = PreviewCard.createHandle();
    const view = render(() => (
      <PreviewCard.Trigger data-testid="handle-trigger" href="#a" handle={handle}>
        Trigger
      </PreviewCard.Trigger>
    ));
    flush();
    expect(renderPathOf(screen.getByTestId('handle-trigger'))).toBe('slow');
    view.unmount();
  });

  it('costs at most base at mount and after the first hover, as a whole tree', async () => {
    const cost = await handleTreeCost(render, handleTree(), firstIntent);
    expect(cost.mount, `mount ${cost.mount}`).toBeLessThanOrEqual(HANDLE_TREE_BUDGET.mount);
    expect(cost.total, `after the first hover ${cost.total}`).toBeLessThanOrEqual(
      HANDLE_TREE_BUDGET.total,
    );
  });
});
