/*
 * A native element's attribute effect (plan 3 leaf 5.1.6): its compute and apply are its writer's
 * methods, bound once, so an element holds no closures and no scope for them, and a hydrating
 * element's writer holds its hydration state, with no object of its own. Hydration allocated about
 * 1 KB per native element beyond the floor, spread across the kit.
 */
import { flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from '../../collapsible/panel/renderPanel.ssr-fixtures';

const effects = vi.hoisted(() => ({ on: false, names: [] as string[] }));

vi.mock('solid-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('solid-js')>();
  return {
    ...actual,
    createRenderEffect: (compute: any, apply: any, ...rest: any[]) => {
      if (effects.on && (new Error().stack ?? '').includes('utils/native/element.ts')) {
        effects.names.push(`${compute?.name}|${apply?.name}`);
      }
      return (actual.createRenderEffect as any)(compute, apply, ...rest);
    },
  };
});

describe('native element attribute effect', () => {
  const { render } = createRenderer();

  it("is its writer's bound compute and apply in a client render", () => {
    effects.names = [];
    effects.on = true;
    render(() => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ));
    flush();
    effects.on = false;
    expect(effects.names.length).toBeGreaterThan(0);
    expect(new Set(effects.names)).toEqual(new Set(['bound compute|bound apply']));
  });

  it("is its writer's bound compute and apply while hydrating", () => {
    effects.names = [];
    effects.on = true;
    const { hydrate } = renderServer(fixtures, 'collapsibleOpen');
    hydrate();
    flush();
    effects.on = false;
    expect(effects.names.length).toBeGreaterThan(0);
    expect(new Set(effects.names)).toEqual(new Set(['bound compute|bound apply']));
  });
});
