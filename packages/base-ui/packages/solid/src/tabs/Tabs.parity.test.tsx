/*
 * Native vs slow path parity for Tabs (plan 8 step 3.2): the same tree through the native fast
 * paths and through `useRenderElement` (`render="<tag>"` on every part) must produce identical
 * DOM after mount and after every interaction (clicks, keyboard navigation, controlled changes),
 * and call handlers in the same order.
 */
import { createRenderer } from '#test-utils';
import { Tabs } from '@solidports/base-ui/tabs';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { part, renderParity } from '../../test/parityHarness';

describe('native parity: Tabs', () => {
  const { render } = createRenderer();

  const tabs = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));

  function tree(
    slow: boolean,
    rootProps: object = {},
    listProps: object = {},
    tabProps: (index: number) => object = () => ({}),
    panelProps: (index: number) => object = () => ({}),
    indicator = true,
  ) {
    return part(Tabs.Root, slow, 'div', {
      ...rootProps,
      get children() {
        return [
          part(Tabs.List, slow, 'div', {
            ...listProps,
            get children() {
              const list = [0, 1, 2].map((index) =>
                part(Tabs.Tab, slow, 'button', {
                  value: `item-${index}`,
                  children: `Tab ${index}`,
                  ...tabProps(index),
                }),
              );
              if (indicator) {
                list.push(part(Tabs.Indicator, slow, 'span', {}));
              }
              return list;
            },
          }),
          ...[0, 1, 2].map((index) =>
            part(Tabs.Panel, slow, 'div', {
              value: `item-${index}`,
              children: `Panel ${index}`,
              ...panelProps(index),
            }),
          ),
        ];
      },
    });
  }

  it('renders and switches identically (uncontrolled)', async () => {
    const pair = renderParity(render, (slow) => tree(slow));
    pair.same();
    expect(pair.fast.querySelectorAll('[role="tabpanel"]').length).toBe(1);
    expect(pair.fast.querySelector('[role="tab"][aria-selected="true"]')).to.have.text('Tab 0');
    pair.both((root) => fireEvent.click(tabs(root)[2]));
    expect(pair.fast.querySelector('[role="tab"][aria-selected="true"]')).to.have.text('Tab 2');
    await pair.bothAsync((root) => {
      tabs(root)[2].focus();
      fireEvent.keyDown(tabs(root)[2], { key: 'ArrowLeft' });
    });
    expect(pair.fast.querySelector('[role="tab"][tabindex="0"]')).to.have.text('Tab 1');
    await pair.bothAsync((root) =>
      fireEvent.keyDown(root.querySelector('[role="tablist"]')!, { key: 'Home' }),
    );
    expect(pair.fast.querySelector('[role="tab"][tabindex="0"]')).to.have.text('Tab 0');
    pair.unmount();
  });

  it('renders identically with every prop form (controlled, vertical, keepMounted)', async () => {
    const [value, setValue] = createSignal<string | null>('item-1');
    const [disabled, setDisabled] = createSignal(false);
    const pair = renderParity(render, (slow) =>
      tree(
        slow,
        {
          orientation: 'vertical',
          get value() {
            return value();
          },
          class: (state: Tabs.Root.State) => `dir-${state.tabActivationDirection}`,
          'data-foo': 'bar',
        },
        { activateOnFocus: true, loopFocus: false, class: 'list', style: { gap: '1px' } },
        (index) => ({
          get disabled() {
            return index === 2 && disabled();
          },
          class: (state: Tabs.Tab.State) => (state.active ? 'active' : 'inactive'),
          style: { color: 'red' },
          id: `tab-${index}`,
          get title() {
            return `${index}:${disabled()}`;
          },
        }),
        (index) => ({ keepMounted: index !== 1, class: 'panel', lang: 'fr' }),
      ),
    );
    pair.same();
    expect(pair.fast.querySelectorAll('[role="tabpanel"]').length).toBe(3);
    expect(pair.fast.querySelector('[role="tablist"]')).to.have.attribute(
      'aria-orientation',
      'vertical',
    );
    pair.both(() => setValue('item-2'));
    pair.both(() => setDisabled(true));
    pair.both((root) => fireEvent.click(tabs(root)[2]));
    pair.both(() => setValue('item-0'));
    await pair.bothAsync((root) => {
      tabs(root)[0].focus();
      fireEvent.keyDown(tabs(root)[0], { key: 'ArrowDown' });
    });
    pair.both(() => setValue(null));
    pair.unmount();
  });

  it('calls consumer handlers in the same order and honors preventBaseUIHandler', () => {
    const run = (slow: boolean) => {
      const calls: string[] = [];
      const result = render(() =>
        tree(
          slow,
          { onValueChange: (value: string) => calls.push(`value:${value}`) },
          { onKeyDown: (event: KeyboardEvent) => calls.push(`list-keydown:${event.key}`) },
          (index) => ({
            onClick: (event: MouseEvent & { preventBaseUIHandler: () => void }) => {
              calls.push(`click:${index}`);
              if (index === 2) {
                event.preventBaseUIHandler();
              }
            },
            onFocus: () => calls.push(`focus:${index}`),
            onKeyDown: (event: KeyboardEvent) => calls.push(`keydown:${index}:${event.key}`),
            onKeyUp: (event: KeyboardEvent) => calls.push(`keyup:${index}:${event.key}`),
            onPointerDown: () => calls.push(`pointerdown:${index}`),
          }),
        ),
      );
      const list = tabs(result.container);
      calls.push(`p:${fireEvent.click(list[1])}`);
      flush();
      calls.push(`p:${fireEvent.click(list[2])}`);
      flush();
      list[1].focus();
      flush();
      calls.push(`p:${fireEvent.keyDown(list[1], { key: ' ' })}`);
      flush();
      calls.push(`p:${fireEvent.keyUp(list[1], { key: ' ' })}`);
      calls.push(`p:${fireEvent.keyDown(list[1], { key: 'ArrowRight' })}`);
      flush();
      calls.push(`p:${fireEvent.pointerDown(list[0])}`);
      calls.push(
        `selected:${result.container.querySelector('[role="tab"][aria-selected="true"]')?.textContent}`,
      );
      result.unmount();
      return calls;
    };
    const fast = run(false);
    expect(fast).toContain('value:item-1');
    expect(fast).not.toContain('value:item-2');
    expect(fast).toEqual(run(true));
  });

  it('applies refs the same way', () => {
    const run = (slow: boolean) => {
      const refs = { root: vi.fn(), list: vi.fn(), tab: vi.fn(), panel: vi.fn(), indicator: vi.fn() };
      const result = render(() =>
        part(Tabs.Root, slow, 'div', {
          ref: refs.root,
          get children() {
            return [
              part(Tabs.List, slow, 'div', {
                ref: refs.list,
                get children() {
                  return [
                    part(Tabs.Tab, slow, 'button', { value: 0, children: 'Tab', ref: refs.tab }),
                    part(Tabs.Indicator, slow, 'span', { ref: refs.indicator }),
                  ];
                },
              }),
              part(Tabs.Panel, slow, 'div', { value: 0, children: 'Panel', ref: refs.panel }),
            ];
          },
        }),
      );
      const tags = Object.values(refs).map((ref) =>
        ref.mock.calls.map((call) => (call[0] as Element).tagName).join(),
      );
      result.unmount();
      return tags;
    };
    expect(run(false)).toEqual(['DIV', 'DIV', 'BUTTON', 'DIV', 'SPAN']);
    expect(run(false)).toEqual(run(true));
  });
});
