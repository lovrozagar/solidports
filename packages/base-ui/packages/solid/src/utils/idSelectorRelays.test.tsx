/*
 * Keyed selectors' writers push (D21): the catch-all effect of `createIdSelector` writes only when a
 * current id changed with no writer pushing it, a flush where the new id shows beside its stale
 * membership. A popup opened and closed by its controlled `open` prop resets its highlight through
 * the store, so the catch-all writes nothing there either.
 */
import { createMemo, createRoot, createSignal, flush, For } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { Tabs } from '@solidports/base-ui/tabs';
import { Menu } from '@solidports/base-ui/menu';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { createIdSelector, idSelectorRelays } from './createIdSelector';

const highlighted = () => document.querySelectorAll('[data-highlighted]').length;

describe('the catch-all effect', () => {
  // Its first run is skipped (the selector seeded from the latest id when it started); its baseline
  // is that seed, so a later change no writer pushes still reaches exactly the old and new id.
  it('a start in the same flush as a change, then an un-pushed change, re-runs the old and new id', () => {
    idSelectorRelays.writes = 0;
    const runs = [0, 0, 0];
    let setOpen!: (next: boolean) => void;
    let setCurrent!: (next: number) => void;
    let items!: () => (() => boolean)[];
    const dispose = createRoot((disposeRoot) => {
      const [open, setOpenSignal] = createSignal(false);
      const [current, setCurrentSignal] = createSignal(0);
      setOpen = setOpenSignal;
      setCurrent = setCurrentSignal;
      // Nothing pushes: `current` is a plain signal, as a controlled prop is.
      const isCurrent = createIdSelector(current);
      items = createMemo(() =>
        open()
          ? [0, 1, 2].map((id) =>
              createMemo(() => {
                runs[id] += 1;
                return isCurrent(id);
              }),
            )
          : [],
      );
      void items();
      flush();
      return disposeRoot;
    });
    const read = () => items().map((item) => item());
    // The selector starts in the flush that also changes the current id.
    setOpen(true);
    setCurrent(1);
    flush();
    expect(read()).toEqual([false, true, false]);
    expect(idSelectorRelays.writes).toBe(0);
    runs.fill(0);
    setCurrent(2);
    flush();
    expect(read()).toEqual([false, false, true]);
    expect(runs).toEqual([0, 1, 1]);
    expect(idSelectorRelays.writes).toBe(1);
    runs.fill(0);
    setCurrent(0);
    flush();
    expect(read()).toEqual([true, false, false]);
    expect(runs).toEqual([1, 0, 1]);
    expect(idSelectorRelays.writes).toBe(2);
    // Made on purpose here: the global check fails any other test's catch-all write.
    idSelectorRelays.writes = 0;
    dispose();
  });
});

describe('keyed selectors whose writers push', () => {
  const { render } = createRenderer();

  // The selector starts while the list renders, in a root made during that flush: its catch-all
  // effect's first read is the committed id there, so it skips that run (a write from it was a
  // stale id applied over the seed, once per selector start).
  // `defaultValue="two"`: the highlight moves to the selected tab while the list mounts.
  it('uncontrolled Tabs mounted on a later tab and moved by keyboard write nothing through the catch-all', async () => {
    idSelectorRelays.writes = 0;
    render(() => (
      <Tabs.Root defaultValue="two">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
          <Tabs.Tab value="three">Three</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
        <Tabs.Panel value="two">Panel two</Tabs.Panel>
        <Tabs.Panel value="three">Panel three</Tabs.Panel>
      </Tabs.Root>
    ));
    flush();
    await flushMicrotasks();
    const [, two, three] = screen.getAllByRole('tab');
    two.focus();
    fireEvent.keyDown(two, { key: 'ArrowRight' });
    flush();
    fireEvent.keyDown(three, { key: 'ArrowRight' });
    flush();
    expect(idSelectorRelays.writes).toBe(0);
  });
});

describe('keyed selectors with a controlled open', () => {
  const { render } = createRenderer();

  it('a Menu closed and reopened by its prop resets its highlight with no catch-all write', async () => {
    idSelectorRelays.writes = 0;
    const [open, setOpen] = createSignal(false);
    const items = ['One', 'Two', 'Three'];
    render(() => (
      <Menu.Root open={open()} onOpenChange={(next) => setOpen(next)}>
        <Menu.Trigger>Menu</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <For each={items}>{(item) => <Menu.Item>{item}</Menu.Item>}</For>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    setOpen(true);
    flush();
    await flushMicrotasks();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    flush();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    flush();
    expect(highlighted()).toBe(1);
    setOpen(false);
    flush();
    await flushMicrotasks();
    setOpen(true);
    flush();
    await flushMicrotasks();
    expect(highlighted()).toBe(0);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    flush();
    expect(highlighted()).toBe(1);
    expect(idSelectorRelays.writes).toBe(0);
  });

  it('a Combobox closed and reopened by its prop keeps one highlight at most, with no catch-all write', async () => {
    idSelectorRelays.writes = 0;
    const [open, setOpen] = createSignal(false);
    render(() => (
      <Combobox.Root items={['apple', 'banana', 'cherry']} open={open()} onOpenChange={(next) => setOpen(next)}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    setOpen(true);
    flush();
    await flushMicrotasks();
    fireEvent.keyDown(screen.getByTestId('input'), { key: 'ArrowDown' });
    flush();
    expect(highlighted()).toBeLessThanOrEqual(1);
    setOpen(false);
    flush();
    await flushMicrotasks();
    setOpen(true);
    flush();
    await flushMicrotasks();
    expect(highlighted()).toBeLessThanOrEqual(1);
    expect(idSelectorRelays.writes).toBe(0);
  });
});
