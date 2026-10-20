/*
 * What a tab switch re-runs (plan 3 push gate, regate3c's tabs/200-vertical click tab 150): every
 * tab and panel reads "am I the selected one", "am I the highlighted one" and its panel's id. Read
 * as a direct compare against the selected value and the highlighted index, or through one version
 * signal over the panel ids, each of those re-runs every tab on a switch: 607 attribute effect runs
 * at 200 tabs. Read through `createIdSelector` and `createKeyedValues`, they re-run the old and the
 * new tab and panel only, so the values' subscribers do not grow with the number of tabs.
 */
import { createRenderEffect, createRoot, DEV, flush, For, getOwner } from 'solid-js';
import { fireEvent, within } from '@solidjs/testing-library';
import { describe, expect, it, onTestFinished } from 'vitest';
import { Tabs } from '@solidports/base-ui/tabs';
import { createRenderer } from '#test-utils';
import { useCompositeRootContext } from '../internals/composite/root/CompositeRootContext';
import type { CompositeRootContext } from '../internals/composite/root/CompositeRootContext';
import { useTabsRootContext } from './root/TabsRootContext';
import type { TabsRootContext } from './root/TabsRootContext';

/** The computations other than a probe's that read what `read` reads. */
function subscribers(read: () => void) {
  let probe: unknown;
  const dispose = createRoot((disposeRoot) => {
    createRenderEffect(
      () => {
        probe = getOwner();
        read();
      },
      () => {},
    );
    return disposeRoot;
  });
  onTestFinished(dispose);
  return () =>
    (DEV!.getSources(probe as never) as unknown[]).reduce<number>(
      (count, source) =>
        count +
        (DEV!.getObservers(source as never) as unknown[]).filter((observer) => observer !== probe)
          .length,
      0,
    );
}

describe('Tabs: a switch re-runs the old and the new tab only', () => {
  const { render } = createRenderer();

  function mount(count: number) {
    let root!: TabsRootContext;
    let composite!: CompositeRootContext;
    function RootProbe() {
      root = useTabsRootContext();
      return null;
    }
    function ListProbe() {
      composite = useCompositeRootContext();
      return null;
    }
    const values = Array.from({ length: count }, (_, i) => `tab-${i}`);
    const view = render(() => (
      <Tabs.Root defaultValue="tab-0" orientation="vertical">
        <RootProbe />
        <Tabs.List>
          <ListProbe />
          <For each={values}>{(value) => <Tabs.Tab value={value}>{value}</Tabs.Tab>}</For>
        </Tabs.List>
        <For each={values}>{(value) => <Tabs.Panel value={value}>{value}</Tabs.Panel>}</For>
      </Tabs.Root>
    ));
    flush();
    const selected = subscribers(() => root.value());
    const highlighted = subscribers(() => composite.highlightedIndex());
    const click = (index: number) => {
      fireEvent.click(within(view.container).getAllByRole('tab')[index]);
      flush();
    };
    const selectedTabs = () =>
      within(view.container)
        .getAllByRole('tab', { selected: true })
        .map((tab) => tab.textContent);
    return { selected, highlighted, click, selectedTabs };
  }

  it('the selected value and the highlighted index have as many subscribers at 200 tabs as at 20', () => {
    const small = mount(20);
    small.click(15);
    const few = { selected: small.selected(), highlighted: small.highlighted() };
    expect(small.selectedTabs()).toEqual(['tab-15']);
    const large = mount(200);
    large.click(150);
    expect(large.selectedTabs()).toEqual(['tab-150']);
    expect({ selected: large.selected(), highlighted: large.highlighted() }).toEqual(few);
  });
});
