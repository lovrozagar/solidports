/*
 * A native part binds its handlers from a module-level table (plan 3 leaf 5.1.4): each element's
 * delegated handler (Solid's `_$$<event>`, with `_$$<event>Data`) is the table's shared dispatcher,
 * with one `HandlerRecord` per element as its data, so an element allocates no closure per key.
 */
import { flush } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { Collapsible } from '@solidports/base-ui/collapsible';
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
