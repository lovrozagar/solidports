/*
 * A native element creates its hydration state only while hydrating (plan 3 leaf 5.1.4): a client
 * render has no server markup to match, and the state's closures were nine per Accordion item.
 */
import { flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from '../../collapsible/panel/renderPanel.ssr-fixtures';

// Counts constructions of the hydration state, which is otherwise unchanged.
const created = vi.hoisted(() => ({ count: 0 }));
vi.mock('./hydrationState', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hydrationState')>();
  class CountedHydrationState extends actual.HydrationState {
    constructor(...args: ConstructorParameters<typeof actual.HydrationState>) {
      super(...args);
      created.count += 1;
    }
  }
  return { ...actual, HydrationState: CountedHydrationState };
});

describe('native element hydration state', () => {
  const { render } = createRenderer();

  it('is not created in a client render', () => {
    created.count = 0;
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    flush();
    expect(created.count).toBe(0);
  });

  it('is created for the elements a hydration claims', () => {
    created.count = 0;
    const { hydrate } = renderServer(fixtures, 'collapsibleOpen');
    hydrate();
    flush();
    expect(created.count).toBeGreaterThan(0);
  });
});
