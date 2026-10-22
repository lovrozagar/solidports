/*
 * A closed popup root builds its open-only machinery (the active-trigger reconciliation) on its
 * first open, not on mount (D32's closed-root unit). These pin every way a root opens without an
 * intent on its trigger: a controlled `open` from app code, `defaultOpen`, a server-rendered open
 * root hydrating, and the handle's imperative `open`. In each, the reconciliation still makes the
 * only trigger the active one. The machinery is a latch: closing keeps it, so opening again builds
 * nothing.
 */
import { createSignal, DEV, flush, Show } from 'solid-js';
import { screen, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Popover } from '@solidports/base-ui/popover';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { createRenderer } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from './PopoverRoot.ssr-fixtures';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

afterEach(() => {
  hooks.onOwner = undefined;
});

/** Nodes a repeat open creates (popup parts, interactions branch), with nothing rebuilt. */
const REPEAT_OPEN_BUDGET = 252;

function expectActiveTrigger(trigger: HTMLElement) {
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(trigger).toHaveAttribute('data-popup-open');
}

describe('Popover.Root: open-only machinery on every open path', () => {
  const { render } = createRenderer();

  const popover = (rootProps: Popover.Root.Props) => (
    <Popover.Root {...rootProps}>
      <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="popup">Content</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );

  it('a controlled open from app code makes the only trigger active', async () => {
    const [open, setOpen] = createSignal(false);
    render(() =>
      popover({
        get open() {
          return open();
        },
      }),
    );
    setOpen(true);
    flush();
    await waitFor(() => expectActiveTrigger(screen.getByTestId('trigger')));
  });

  it('defaultOpen makes the only trigger active', async () => {
    render(() => popover({ defaultOpen: true }));
    await waitFor(() => expectActiveTrigger(screen.getByTestId('trigger')));
  });

  it('a server-rendered open root makes the only trigger active once hydrated', async () => {
    const { hydrate } = renderServer(fixtures, 'defaultOpenTrigger');
    hydrate();
    await waitFor(() => expectActiveTrigger(screen.getByTestId('trigger')));
  });

  it("the handle's imperative open makes the trigger active and resolves its element", async () => {
    const handle = Popover.createHandle();
    render(() => (
      <Popover.Root handle={handle}>
        <Popover.Trigger handle={handle} id="trigger" data-testid="trigger">
          Open
        </Popover.Trigger>
      </Popover.Root>
    ));
    handle.open('trigger');
    flush();
    const trigger = screen.getByTestId('trigger');
    await waitFor(() => expectActiveTrigger(trigger));
    expect(handle.store.select('activeTriggerElement')).toBe(trigger);
  });

  it('opening again after a close builds no more machinery', async () => {
    const [open, setOpen] = createSignal(false);
    render(() =>
      popover({
        get open() {
          return open();
        },
      }),
    );
    const created: number[] = [];
    const cycle = async (next: boolean) => {
      let count = 0;
      hooks.onOwner = (owner) => {
        count += owner ? 1 : 0;
      };
      setOpen(next);
      flush();
      await waitFor(() =>
        expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', String(next)),
      );
      hooks.onOwner = undefined;
      created.push(count);
    };
    await cycle(true);
    await cycle(false);
    await cycle(true);
    await cycle(false);
    await cycle(true);
    // The first open builds the root's open-only machinery and later opens reuse it: from the
    // third open on (the second still creates a few store selectors on their first read), an open
    // creates no more than it did while that machinery was built at mount (252 at b8af4ee6).
    // Rebuilding it on each open would add its nodes to every open.
    expect(
      created[4],
      `opens ${created.filter((_, i) => i % 2 === 0).join(', ')}`,
    ).toBeLessThanOrEqual(REPEAT_OPEN_BUDGET);
  });
});

// Tooltip passes `closeOnActiveTriggerUnmount`: the reconciliation closes it when its active trigger
// unmounts while open, on an open that came from no intent.
describe('open-only machinery when the active trigger unmounts', () => {
  const { render } = createRenderer();

  it('a default-open tooltip closes when its active trigger unmounts', async () => {
    const [shown, setShown] = createSignal(true);
    render(() => (
      <Tooltip.Root defaultOpen>
        <Show when={shown()}>
          <Tooltip.Trigger data-testid="trigger">Trigger</Tooltip.Trigger>
        </Show>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    await waitFor(() => expect(screen.getByTestId('trigger')).toHaveAttribute('data-popup-open'));
    setShown(false);
    flush();
    await waitFor(() => expect(screen.queryByTestId('popup')).toBe(null));
  });

  it('a controlled-open tooltip closes when its active trigger unmounts', async () => {
    const [shown, setShown] = createSignal(true);
    const [open, setOpen] = createSignal(false);
    render(() => (
      <Tooltip.Root open={open()} onOpenChange={(next) => setOpen(next)}>
        <Show when={shown()}>
          <Tooltip.Trigger data-testid="trigger">Trigger</Tooltip.Trigger>
        </Show>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    setOpen(true);
    flush();
    await waitFor(() => expect(screen.getByTestId('trigger')).toHaveAttribute('data-popup-open'));
    setShown(false);
    flush();
    await waitFor(() => expect(screen.queryByTestId('popup')).toBe(null));
  });
});
