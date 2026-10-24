/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Parity for Toast.Arrow on the native path (D32's sweep): an anchored toast's arrows render
 * natively, then, alone, forced onto the slow path (`part`), and the two must produce the same
 * normalized document after each side and align change. The positioner's arrow styles sit below
 * the consumer's style (a consumer key wins), as the slow path's merge puts them.
 */
import { createSignal, flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { Toast } from '@solidports/base-ui/toast';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../../test/parityHarness';
import { renderPathOf } from '../../utils/renderPath';

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';
type Step = () => void;

interface Controls {
  setSide: (side: Side) => void;
  setAlign: (align: Align) => void;
  /** Moves the anchor to the viewport's left edge, 2px wide: the arrow cannot center on it. */
  toEdge: () => void;
}

/** Arrows with a size, so the positioner measures them (`arrowRef`) and offsets them. */
const ARROW_SIZE = '[data-arrow] { width: 10px; height: 10px; }';

const toast: Toast.Root.ToastObject = { id: 'anchored', title: 'Saved' };

/** Positioning settles after a frame or two. */
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 60);
  });

describe('native parity: toast arrows', () => {
  const { render } = createRenderer();

  async function snapshots(slow: boolean, steps: (controls: Controls) => Step[]) {
    const [side, setSide] = createSignal<Side>('bottom');
    const [align, setAlign] = createSignal<Align>('center');
    const anchor = document.createElement('button');
    Object.assign(anchor.style, {
      position: 'absolute',
      top: '200px',
      left: '200px',
      width: '80px',
      height: '20px',
    });
    document.body.append(anchor);
    const sheet = document.createElement('style');
    sheet.textContent = ARROW_SIZE;
    document.head.append(sheet);
    const toEdge = () => Object.assign(anchor.style, { left: '0px', width: '2px' });
    const arrow = (props: Record<string, unknown>) => part(Toast.Arrow, slow, 'div', props);
    const view = render(() => (
      <Toast.Provider>
        <Toast.Positioner toast={toast} anchor={anchor} side={side()} align={align()}>
          <Toast.Root toast={toast}>
            {arrow({ 'data-arrow': 'plain' })}
            {arrow({
              'data-arrow': 'styled',
              // `position` collides with the positioner's arrow styles: the consumer's wins.
              style: { position: 'relative', color: 'red' },
            })}
            {arrow({
              'data-arrow': 'stateful',
              class: (state: { side: string; align: string; uncentered: boolean }) =>
                `arrow-${state.side}-${state.align}${state.uncentered ? '-uncentered' : ''}`,
            })}
            <Toast.Title />
          </Toast.Root>
        </Toast.Positioner>
      </Toast.Provider>
    ));
    flush();
    await settle();
    flush();
    const record = () => {
      const arrows = [...document.body.querySelectorAll('[data-arrow]')];
      expect(arrows).toHaveLength(3);
      expect(arrows.map((el) => renderPathOf(el))).not.toContain(slow ? 'native' : 'slow');
      return arrows.map((el) => {
        const wrapper = document.createElement('div');
        wrapper.append(el.cloneNode(true));
        return normalizeTree(wrapper);
      });
    };
    const trees = [record()];
    for (const step of steps({ setSide, setAlign, toEdge })) {
      step();
      flush();
      // eslint-disable-next-line no-await-in-loop -- the steps run in order
      await settle();
      flush();
      trees.push(record());
    }
    view.unmount();
    view.container.remove();
    anchor.remove();
    sheet.remove();
    return trees;
  }

  it('Toast.Arrow renders the same DOM through side and align changes', async () => {
    const steps = ({ setSide, setAlign, toEdge }: Controls): Step[] => [
      () => setSide('top'),
      () => setAlign('start'),
      () => setSide('right'),
      () => setAlign('end'),
      () => setSide('left'),
      () => setAlign('center'),
      () => setSide('bottom'),
      toEdge,
      () => setAlign('start'),
    ];
    const native = await snapshots(false, steps);
    const slow = await snapshots(true, steps);
    expect(native).toEqual(slow);
  });
});
