/*
 * A Tabs whose tabs come and go (an editor's tabs, each with a fresh value): the selected value's
 * keyed selector holds an entry per value with a live reader only, so values that churn through one
 * Tabs.Root do not accumulate for the root's life.
 */
import { createSignal, flush, For } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { Tabs } from '@solidports/base-ui/tabs';
import { createRenderer } from '#test-utils';
import { useTabsRootContext } from './root/TabsRootContext';
import type { TabsRootContext } from './root/TabsRootContext';

describe('Tabs: tabs that come and go', () => {
  const { render } = createRenderer();

  it('holds entries for the live tabs only after 1,000 unique values mount and unmount', () => {
    let root!: TabsRootContext;
    function RootProbe() {
      root = useTabsRootContext();
      return null;
    }
    const batch = (start: number) => Array.from({ length: 100 }, (_, i) => `tab-${start + i}`);
    const [values, setValues] = createSignal(batch(0));
    render(() => (
      <Tabs.Root defaultValue="pinned">
        <RootProbe />
        <Tabs.List>
          <Tabs.Tab value="pinned">Pinned</Tabs.Tab>
          <For each={values()}>{(value) => <Tabs.Tab value={value}>{value}</Tabs.Tab>}</For>
        </Tabs.List>
        <Tabs.Panel value="pinned">Pinned panel</Tabs.Panel>
      </Tabs.Root>
    ));
    flush();
    const live = () => values().length + 1;
    expect(root.isActive.size()).toBeLessThanOrEqual(live() + 1);
    for (let start = 100; start < 1000; start += 100) {
      setValues(batch(start));
      flush();
      expect(root.isActive.size()).toBeLessThanOrEqual(live() + 1);
    }
    setValues([]);
    flush();
    expect(root.isActive.size()).toBeLessThanOrEqual(2);
  });
});
