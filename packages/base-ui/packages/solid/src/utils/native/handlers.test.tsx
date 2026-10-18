/*
 * A native part binds its handlers from a module-level table (plan 3 leaf 5.1.4): each element's
 * delegated handler (Solid's `_$$<event>`, with `_$$<event>Data`) is the table's shared dispatcher,
 * with one `HandlerRecord` per element as its data, so an element allocates no closure per key.
 */
import { flush } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@solidports/base-ui/button';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { Tabs } from '@solidports/base-ui/tabs';
import { createRenderer } from '#test-utils';
import { HandlerRecord } from './consumer';

type Delegated = Element & Record<string, unknown>;

describe('native handler table', () => {
  const { render } = createRenderer();

  it('binds one shared dispatcher per key, with the element record as its data', () => {
    render(() => (
      <div>
        <Collapsible.Root>
          <Collapsible.Trigger data-testid="a">A</Collapsible.Trigger>
        </Collapsible.Root>
        <Collapsible.Root>
          <Collapsible.Trigger data-testid="b">B</Collapsible.Trigger>
        </Collapsible.Root>
      </div>
    ));
    flush();
    const a = screen.getByTestId('a') as unknown as Delegated;
    const b = screen.getByTestId('b') as unknown as Delegated;
    for (const key of ['_$$click', '_$$keydown', '_$$pointerdown']) {
      expect(typeof a[key]).toBe('function');
      expect(b[key]).toBe(a[key]);
      expect(a[`${key}Data`]).toBeInstanceOf(HandlerRecord);
    }
    expect(b._$$clickData).not.toBe(a._$$clickData);
  });

  it('shares the dispatchers of tabs, a tab list and buttons with consumer handlers', () => {
    const noop = () => {};
    render(() => (
      <div>
        <Tabs.Root defaultValue="a">
          <Tabs.List data-testid="list-a">
            <Tabs.Tab value="a" data-testid="tab-a">
              A
            </Tabs.Tab>
            <Tabs.Tab value="b" data-testid="tab-b">
              B
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
        <Tabs.Root defaultValue="c">
          <Tabs.List data-testid="list-b">
            <Tabs.Tab value="c">C</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
        <Button data-testid="button-a" onClick={noop} onKeyDown={noop}>
          A
        </Button>
        <Button data-testid="button-b" onClick={noop} onKeyDown={noop}>
          B
        </Button>
      </div>
    ));
    flush();
    const pairs: Array<[string, string, string[]]> = [
      ['tab-a', 'tab-b', ['_$$click', '_$$pointerdown', '_$$keydown', '_$$keyup']],
      ['list-a', 'list-b', ['_$$focusin', '_$$keydown']],
      ['button-a', 'button-b', ['_$$click', '_$$keydown']],
    ];
    for (const [first, second, delegated] of pairs) {
      const a = screen.getByTestId(first) as unknown as Delegated;
      const b = screen.getByTestId(second) as unknown as Delegated;
      for (const key of delegated) {
        expect(typeof a[key]).toBe('function');
        expect(b[key]).toBe(a[key]);
        expect(a[`${key}Data`]).toBeInstanceOf(HandlerRecord);
      }
    }
  });

  // `focus` is not delegated: Solid binds the tuple with its own listener, in the same order.
  it('runs a tab consumer onFocus before the part, which it can prevent', () => {
    const seen: Array<string | null> = [];
    const onFocus = vi.fn((event: FocusEvent & { preventBaseUIHandler(): void }) => {
      seen.push((event.currentTarget as Element).getAttribute('aria-selected'));
      if ((event.currentTarget as Element).getAttribute('data-prevent') != null) {
        event.preventBaseUIHandler();
      }
    });
    render(() => (
      <Tabs.Root defaultValue="a">
        <Tabs.List activateOnFocus>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b" data-testid="b" onFocus={onFocus}>
            B
          </Tabs.Tab>
          <Tabs.Tab value="c" data-testid="c" data-prevent="" onFocus={onFocus}>
            C
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    ));
    flush();
    const b = screen.getByTestId('b');
    fireEvent.focus(b);
    flush();
    expect(seen).toEqual(['false']);
    expect(b).toHaveAttribute('aria-selected', 'true');
    const c = screen.getByTestId('c');
    fireEvent.focus(c);
    flush();
    expect(onFocus).toHaveBeenCalledTimes(2);
    expect(c).toHaveAttribute('aria-selected', 'false');
  });

  it('calls the consumer, then the part, and keeps the order a consumer can prevent', () => {
    const onClick = vi.fn((event: { preventBaseUIHandler(): void }) =>
      event.preventBaseUIHandler(),
    );
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger onClick={onClick}>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    flush();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives a render function plain handlers it can call itself', () => {
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger
          render={(props: Record<string, unknown>) => (
            <button
              type="button"
              aria-expanded={props['aria-expanded'] as 'true' | 'false'}
              onClick={(event) => (props.onClick as (event: MouseEvent) => void)(event)}
            >
              Toggle
            </button>
          )}
        />
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    flush();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
