import { createSignal, flush, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { createRenderer } from '#test-utils';
import { REASONS } from '../utils/reasons';
import { FilterDropdownClear } from './clear/FilterDropdownClear';
import { FilterDropdownEmpty } from './empty/FilterDropdownEmpty';
import { useFilterDropdownGroup } from './group/useFilterDropdownGroup';
import { FilterDropdownGroupContext } from './group/FilterDropdownGroupContext';
import { FilterDropdownInput, filterInputValueProps } from './input/FilterDropdownInput';
import { useFilterDropdownItem } from './item/useFilterDropdownItem';
import { FilterDropdownList } from './list/FilterDropdownList';
import { FilterDropdownRoot } from './root/FilterDropdownRoot';
import {
  useFilterContextForList,
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from './root/FilterDropdownRootContext';
import { useFilterDropdownCloseQuery } from './root/useFilterDropdownCloseQuery';
import { isRefocusingOwner, refocusOwner } from './utils/refocusOwner';
import { createLayoutEffect, provideContext } from '../solid-helpers';

describe('filter dropdown', () => {
  const { render } = createRenderer();

  it('filters items, clears the query, and announces an empty result', async () => {
    const indexes: Array<number | null> = [];
    const changes: string[] = [];
    const [value, setValue] = createSignal('');
    const [open, setOpen] = createSignal(true);
    const listRef = { current: [] as Array<HTMLElement | null> };

    render(() => (
      <FilterDropdownRoot
        open={open()}
        value={value()}
        autoHighlight
        listRef={listRef}
        getActiveIndex={() => indexes.at(-1) ?? null}
        setActiveIndex={(index) => indexes.push(index)}
        onValueChange={(next, details) => {
          changes.push(`${details.reason}:${next}`);
          setValue(next);
        }}
      >
        <FilterDropdownInput aria-label="Filter" />
        <FilterDropdownList>
          <Group>
            <Item label="Canada" />
            <Item label="Cameroon" />
            <Item label="Japan" retainGroup />
          </Group>
        </FilterDropdownList>
        <FilterDropdownClear aria-label="Clear" />
        <FilterDropdownEmpty>Nothing matches</FilterDropdownEmpty>
      </FilterDropdownRoot>
    ));
    flush();

    expect(document.querySelector('[role="searchbox"]')).toHaveAttribute('type', 'text');
    expect(document.querySelector('[role="searchbox"]')).toHaveAttribute('inputmode', 'search');
    expect(labels()).toEqual(['Canada', 'Cameroon', 'Japan']);

    fireEvent.input(searchbox(), { target: { value: 'ca' } });
    flush();
    expect(labels()).toEqual(['Canada', 'Cameroon']);
    expect(changes.at(-1)).toBe(`${REASONS.inputChange}:ca`);
    expect(document.querySelector('[aria-label="Clear"]')).not.toBe(null);
    fireEvent.mouseDown(document.querySelector('[aria-label="Clear"]')!);

    fireEvent.click(document.querySelector('[aria-label="Clear"]')!);
    flush();
    expect(value()).toBe('');
    expect(changes.at(-1)).toBe(`${REASONS.clearPress}:`);
    expect(document.querySelector('[aria-label="Clear"]')).toBe(null);

    fireEvent.input(searchbox(), { target: { value: 'zzz' } });
    flush();
    await Promise.resolve();
    flush();
    expect(labels()).toEqual([]);
    expect(document.body.textContent).toContain('Nothing matches');
    fireEvent.input(searchbox(), { target: { value: '' } });

    setOpen(false);
    flush();
  });

  it('keeps the displayed query while a closed popup finishes unmounting', () => {
    const seen: string[] = [];
    const [open, setOpen] = createSignal(true);
    const [mounted, setMounted] = createSignal(true);
    const [value, setValue] = createSignal('can');

    function Probe() {
      const displayed = useFilterDropdownCloseQuery({
        open,
        mounted,
        value,
        onValueChange: (next) => setValue(next),
      });
      seen.push(displayed());
      return <span data-testid="query">{displayed()}</span>;
    }

    render(Probe);
    flush();
    setOpen(false);
    flush();
    expect(value()).toBe('');
    expect(document.querySelector('[data-testid="query"]')?.textContent).toBe('can');

    setMounted(false);
    flush();
    expect(document.querySelector('[data-testid="query"]')?.textContent).toBe('');

    setValue('nope');
    setOpen(true);
    setMounted(true);
    flush();
    setValue('');
    setOpen(false);
    flush();
    expect(document.querySelector('[data-testid="query"]')?.textContent).toBe('');
  });

  it('highlights from the keyboard, the pointer, and a custom or disabled filter', () => {
    const indexes: Array<number | null> = [];
    const [value, setValue] = createSignal('ap');
    const [filterOff, setFilterOff] = createSignal(false);
    const [disabled, setDisabled] = createSignal(true);
    const [highlight, setHighlight] = createSignal<boolean | 'always'>(true);

    render(() => (
      <FilterDropdownRoot
        open
        value={value()}
        filter={
          filterOff() ? null : (text, query) => text.toLowerCase().includes(query.toLowerCase())
        }
        autoHighlight={highlight()}
        openedByKeyboard
        disabled={disabled()}
        triggerId=""
        locale="en"
        listRef={{ current: [] }}
        getActiveIndex={() => null}
        setActiveIndex={(index) => indexes.push(index)}
        onValueChange={(next, details) => {
          if (next === 'nope') {
            details.cancel();
            return;
          }
          setValue(next);
        }}
      >
        <FilterDropdownInput aria-label="Filter" activeItemId="item-1" id={false} />
        <Item label="Apple" />
        <Item label="Apricot" />
        <FilterDropdownClear aria-label="Clear" disabled />
      </FilterDropdownRoot>
    ));
    flush();

    const input = searchbox();
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-activedescendant', 'item-1');
    expect(document.querySelector('[aria-label="Clear"]')).toBeDisabled();
    fireEvent.click(document.querySelector('[aria-label="Clear"]')!);
    expect(value()).toBe('ap');

    setDisabled(false);
    flush();
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.pointerDown(input);
    fireEvent.mouseEnter(input);
    expect(input).toHaveFocus();

    fireEvent.input(input, { target: { value: 'apr' } });
    flush();
    expect(labels()).toEqual(['Apricot']);

    fireEvent.input(input, { target: { value: 'nope' } });
    flush();
    expect(value()).toBe('apr');

    setFilterOff(true);
    setValue('zzz');
    flush();
    expect(labels()).toEqual(['Apple', 'Apricot']);

    setHighlight('always');
    setValue('');
    flush();
    fireEvent.focus(input);
    expect(indexes.at(-1)).toBe(0);
  });

  it('ignores edits while the popup is closed and composition that never started', () => {
    const [value, setValue] = createSignal('can');

    render(() => (
      <FilterDropdownRoot
        open={false}
        value={value()}
        query="can"
        listRef={{ current: [] }}
        getActiveIndex={() => 0}
        setActiveIndex={() => {}}
        onValueChange={setValue}
      >
        <FilterDropdownInput aria-label="Filter" />
        <Item>Canada</Item>
      </FilterDropdownRoot>
    ));
    flush();

    fireEvent.compositionEnd(searchbox(), { target: { value: 'x' } });
    fireEvent.input(searchbox(), { target: { value: 'x' } });
    fireEvent.mouseEnter(searchbox());
    expect(value()).toBe('can');
  });

  it('waits for an IME composition before committing, and refocuses from the list', () => {
    const [value, setValue] = createSignal('');
    const listRef = { current: [] as Array<HTMLElement | null> };

    render(() => (
      <FilterDropdownRoot
        open
        value={value()}
        autoHighlight="always"
        listRef={listRef}
        getActiveIndex={() => 0}
        setActiveIndex={() => {}}
        onValueChange={setValue}
      >
        <FilterDropdownInput aria-label="Filter" />
        <FilterDropdownList data-testid="list">
          <Item label="Canada" />
        </FilterDropdownList>
      </FilterDropdownRoot>
    ));
    flush();

    const input = searchbox();
    fireEvent.compositionStart(input, { target: { value: 'ca' } });
    fireEvent.input(input, { target: { value: 'ca' } });
    expect(value()).toBe('');
    fireEvent.compositionEnd(input, { target: { value: 'ca' } });
    expect(value()).toBe('ca');

    input.focus();
    const list = document.getElementById(input.getAttribute('aria-controls') ?? '') as HTMLElement;
    expect(list).not.toBe(null);
    fireEvent.pointerMove(list);
    fireEvent.pointerDown(list);
    fireEvent.focus(list, { relatedTarget: input });
    expect(input).toHaveFocus();

    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    fireEvent.focus(list, { relatedTarget: outside });
    expect(document.activeElement).not.toBe(input);
  });

  it('hides a group whose items all miss, unless one item retains it', () => {
    const [query, setQuery] = createSignal('zzz');

    render(() => (
      <FilterDropdownRoot
        open
        value={query()}
        listRef={{ current: [] }}
        getActiveIndex={() => null}
        setActiveIndex={() => {}}
        onValueChange={setQuery}
      >
        <Group>
          <Item label="Canada" />
          <Item label="Japan" retainGroup={query() === 'keep'} />
        </Group>
      </FilterDropdownRoot>
    ));
    flush();
    expect(document.querySelector('[data-testid="group"]')).toHaveAttribute('data-hidden', 'true');

    setQuery('can');
    flush();
    expect(document.querySelector('[data-testid="group"]')).toHaveAttribute('data-hidden', 'false');

    setQuery('keep');
    flush();
    expect(document.querySelector('[data-testid="group"]')).toHaveAttribute('data-hidden', 'false');
  });

  it('reads item text from children, a render element, and the DOM, including a detached item', () => {
    const [label, setLabel] = createSignal<string | undefined>(undefined);
    const [child, setChild] = createSignal<unknown>('Canada');

    render(() => (
      <FilterDropdownRoot
        open
        value=""
        listRef={{ current: [] }}
        getActiveIndex={() => null}
        setActiveIndex={() => {}}
      >
        <Item label={label()} children={child()} render={{ children: 'Rendered' }} />
        <DetachedItem />
      </FilterDropdownRoot>
    ));
    flush();
    expect(labels()).toEqual(['Canada', 'Detached']);

    setChild(['Can', 1]);
    flush();
    setChild({ children: 'Nested' });
    flush();
    setChild({ other: true });
    flush();
    setLabel('Named');
    flush();
    expect(labels()).toEqual(['Named', 'Detached']);
  });

  it('throws when a filter part is rendered outside its root', () => {
    function MissingRoot() {
      useFilterDropdownRootContext();
      return null;
    }
    function MissingItem() {
      useFilterDropdownItemContext();
      return null;
    }
    function MissingRegistration() {
      useFilterDropdownItem({});
      return null;
    }

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => render(MissingRoot)).toThrow(/filter context/);
    expect(() => render(MissingItem)).toThrow(/filter context/);
    expect(() => render(MissingRegistration)).toThrow(/filter context/);
  });

  it('walks nested dropdowns to the list owner and stops at a null list', () => {
    const outerList = { current: [] as Array<HTMLElement | null> };
    const innerList = { current: [] as Array<HTMLElement | null> };

    render(() => (
      <FilterDropdownRoot
        open
        value=""
        listRef={outerList}
        getActiveIndex={() => null}
        setActiveIndex={() => {}}
      >
        <FilterDropdownRoot
          open
          value=""
          listRef={innerList}
          getActiveIndex={() => null}
          setActiveIndex={() => {}}
        >
          <Walker listRef={outerList} testid="outer" />
          <Walker listRef={null} testid="none" />
        </FilterDropdownRoot>
      </FilterDropdownRoot>
    ));

    expect(document.querySelector('[data-testid="outer"]')?.textContent).toBe('found');
    expect(document.querySelector('[data-testid="none"]')?.textContent).toBe('missing');
  });

  it('keeps a highlight that still points at the same element and resets one that does not', () => {
    const calls: Array<number | null> = [];
    const element = document.createElement('div');
    const listRef = { current: [element] };

    render(() => (
      <FilterDropdownRoot
        open
        value="a"
        autoHighlight
        listRef={listRef}
        getActiveIndex={() => 0}
        setActiveIndex={(index) => calls.push(index)}
      >
        <ItemsChanged previous={[element]} />
        <ItemsChanged previous={[null]} />
      </FilterDropdownRoot>
    ));

    expect(calls.at(-1)).toBe(0);
  });

  it('covers optional context, repeated queries, and text read from the DOM', async () => {
    function Optional() {
      const root = useFilterDropdownRootContext(true);
      const item = useFilterDropdownItemContext(true);
      const value = useFilterDropdownValueContext();
      return (
        <span data-testid="optional">
          {root == null && item == null && value() === '' ? 'empty' : 'set'}
        </span>
      );
    }
    render(Optional);
    expect(document.querySelector('[data-testid="optional"]')?.textContent).toBe('empty');

    const indexes: Array<number | null> = [];
    const [query, setQuery] = createSignal('a');
    const listRef = { current: [] as Array<HTMLElement | null> };
    const fromList = document.createElement('div');
    listRef.current = [fromList];

    render(() => (
      <FilterDropdownRoot
        open
        value={query()}
        autoHighlight
        listRef={listRef}
        getActiveIndex={() => indexes.at(-1) ?? null}
        setActiveIndex={(index) => indexes.push(index)}
        onValueChange={setQuery}
      >
        <FilterDropdownInput aria-label="Filter" />
        <Item label="Apple" />
        <Item label="Apricot" />
        <Item render={{ children: 'Rendered' }} />
      </FilterDropdownRoot>
    ));
    flush();

    setQuery('ap');
    flush();
    expect(labels()).toEqual(['Apple', 'Apricot']);

    const input = searchbox();
    fireEvent.focus(input, { relatedTarget: fromList });
    expect(indexes).toContain(null);

    const [domText, setDomText] = createSignal('');
    const [same, setSame] = createSignal('one');
    const sameIndexes: Array<number | null> = [];
    render(() => (
      <FilterDropdownRoot
        open
        value={same()}
        autoHighlight
        filter={() => true}
        triggerId="host"
        listRef={{ current: [] }}
        getActiveIndex={() => 0}
        setActiveIndex={(index) => sameIndexes.push(index)}
        onValueChange={setSame}
      >
        <FilterDropdownInput aria-label="Same" />
        <Item label="Apple" />
        <DomText text={domText()} />
        <ItemsChanged previous={[null]} />
        <ClearRenderedListId />
        <FilterDropdownList id="" />
        <FilterDropdownEmpty>Nothing</FilterDropdownEmpty>
      </FilterDropdownRoot>
    ));
    flush();
    setDomText('From DOM');
    flush();
    setDomText('');
    flush();
    await Promise.resolve();
    flush();
    expect(document.body.textContent).not.toContain('Nothing');
    setSame('two');
    flush();
    setSame('three');
    flush();
    expect(sameIndexes).toContain(0);
  });

  it('publishes an external trigger id and treats an empty id as absent', () => {
    function Probe() {
      const context = useFilterDropdownRootContext();
      return <span data-testid="trigger-id">{context.triggerId() ?? 'none'}</span>;
    }
    const [triggerId, setTriggerId] = createSignal<string | null>('');

    render(() => (
      <FilterDropdownRoot
        open
        value=""
        triggerId={triggerId()}
        listRef={{ current: [] }}
        getActiveIndex={() => null}
        setActiveIndex={() => {}}
      >
        <Probe />
      </FilterDropdownRoot>
    ));
    flush();
    expect(document.querySelector('[data-testid="trigger-id"]')?.textContent).toBe('none');

    setTriggerId('host');
    flush();
    expect(document.querySelector('[data-testid="trigger-id"]')?.textContent).toBe('host');
  });

  it('binds the input value as an attribute on the server and a property in the browser', () => {
    expect(filterInputValueProps(true, () => 'server').value).toBe('server');
    expect(filterInputValueProps(false, () => 'client')['prop:value']).toBe('client');
  });

  it('marks a programmatic refocus and clears the mark if focus throws', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.addEventListener('focus', () => {
      expect(isRefocusingOwner()).toBe(true);
    });
    refocusOwner(input);
    expect(isRefocusingOwner()).toBe(false);
    expect(document.activeElement).toBe(input);

    const broken = {
      focus() {
        throw new Error('focus failed');
      },
    } as HTMLElement;
    expect(() => refocusOwner(broken)).toThrow('focus failed');
    expect(isRefocusingOwner()).toBe(false);
  });
});

function DomText(props: { text: string }) {
  const element = document.createElement('div');
  const filter = useFilterDropdownItem({
    get children() {
      element.textContent = props.text;
      return props.text;
    },
  });
  filter.ref.current = element;
  return null;
}

function ClearRenderedListId() {
  const context = useFilterDropdownRootContext();
  createLayoutEffect(
    () => true,
    () => {
      context.setRenderedListId('');
    },
  );
  return <span data-testid="list-id">{context.listId() ?? 'none'}</span>;
}

function searchbox() {
  return document.querySelector('[role="searchbox"]') as HTMLInputElement;
}

function labels() {
  return Array.from(document.querySelectorAll('[role="menuitem"]'), (item) => item.textContent);
}

function Item(props: {
  label?: string;
  children?: unknown;
  render?: unknown;
  retainGroup?: boolean;
}) {
  const filter = useFilterDropdownItem({
    get label() {
      return props.label;
    },
    get children() {
      return props.children;
    },
    get render() {
      return props.render;
    },
    get retainGroup() {
      return props.retainGroup;
    },
  });
  return (
    <Show when={filter.visible()}>
      <div
        role="menuitem"
        ref={(node) => {
          filter.ref.current = node;
        }}
      >
        {props.label ??
          (typeof props.children === 'string' || typeof props.children === 'number'
            ? String(props.children)
            : null)}
      </div>
    </Show>
  );
}

function DetachedItem() {
  const filter = useFilterDropdownItem({ context: null, label: 'Detached' });
  return (
    <Show when={filter.visible()}>
      <div
        role="menuitem"
        ref={(node) => {
          filter.ref.current = node;
        }}
      >
        Detached
      </div>
    </Show>
  );
}

function Group(props: { children: JSX.Element }) {
  const group = useFilterDropdownGroup();
  return provideContext(FilterDropdownGroupContext, group.context, () => (
    <div data-testid="group" data-hidden={group.hidden() ? 'true' : 'false'}>
      {props.children}
    </div>
  ));
}

function Walker(props: { listRef: { current: Array<HTMLElement | null> } | null; testid: string }) {
  const found = useFilterContextForList(props.listRef);
  return <span data-testid={props.testid}>{found ? 'found' : 'missing'}</span>;
}

function ItemsChanged(props: { previous: Array<HTMLElement | null> }) {
  const context = useFilterDropdownRootContext();
  createLayoutEffect(
    () => props.previous,
    (previous) => {
      context.onItemsChange(previous);
    },
  );
  return null;
}
