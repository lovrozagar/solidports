/*
 * The list assigns its items' indexes in an effect, and its items' attribute effects apply after it,
 * once, with their index. The list's JSX provider orders them so: its children memo puts the items
 * below the list (a flush applies effects by reactive height). Rendered under a transparent owner
 * instead (b75c8bd5), every item's attribute effects computed twice, first with no index, and a
 * 500-item Menu open ran 4,300 more computations (GOTCHA-019).
 */
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from '@solidports/base-ui/menu';
import { createRenderer, isJSDOM } from '#test-utils';

const counts = vi.hoisted(() => ({ on: false, created: 0, runs: 0 }));

vi.mock('solid-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('solid-js')>();
  return {
    ...actual,
    createRenderEffect: (compute: any, ...rest: any[]) => {
      if (counts.on && (new Error().stack ?? '').includes('utils/useRenderElement.tsx')) {
        counts.created += 1;
        const counted = (...args: unknown[]) => {
          counts.runs += 1;
          return compute(...args);
        };
        return (actual.createRenderEffect as any)(counted, ...rest);
      }
      return (actual.createRenderEffect as any)(compute, ...rest);
    },
  };
});

// vi.mock('solid-js') does not reach the runtime in browser mode, so nothing would be counted.
describe.skipIf(!isJSDOM)('CompositeList effect order', () => {
  const { render } = createRenderer();

  it('computes the item attribute effects of a menu that opens once each', async () => {
    const [open, setOpen] = createSignal(false);
    await render(() => (
      <Menu.Root open={open()}>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              {Array.from({ length: 20 }, (_, i) => (
                <Menu.Item>Item {i}</Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    flush();
    // As the bench's open: a mounted, closed menu opens.
    counts.created = 0;
    counts.runs = 0;
    counts.on = true;
    setOpen(true);
    flush();
    await Promise.resolve();
    flush();
    counts.on = false;
    expect(counts.created).toBeGreaterThan(20);
    // At most a few re-runs outside the items (the trigger, the positioner): none per item.
    expect(counts.runs - counts.created).toBeLessThan(20);
  });
});
