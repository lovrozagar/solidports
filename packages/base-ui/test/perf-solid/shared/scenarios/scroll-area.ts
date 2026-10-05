import { drag, hover, nextPaint, q, unhover } from '../drivers';
import type { Scenario } from '../types';

const viewport = () => q('[data-testid="viewport"]');
const thumb = () => q('[data-testid="thumb"]');
const summary = () => ({
  scrollTop: Math.round(viewport().scrollTop),
  thumbHeight: Math.round(thumb().getBoundingClientRect().height),
  rows: viewport().querySelectorAll('[data-row]').length,
});

const scenarios: Scenario[] = [
  {
    id: 'scroll-area/1000-rows',
    fixture: 'scroll-area/rows',
    steps: [
      {
        name: 'scroll x100',
        run: async () => {
          for (let i = 1; i <= 100; i += 1) {
            viewport().scrollTop = i * 40;
            await nextPaint();
          }
        },
        verify: summary,
      },
      {
        name: 'wheel x100',
        run: async () => {
          for (let i = 0; i < 100; i += 1) {
            viewport().dispatchEvent(
              new WheelEvent('wheel', { deltaY: -40, bubbles: true, cancelable: true }),
            );
            viewport().scrollTop -= 40;
            await nextPaint();
          }
        },
        verify: summary,
      },
      {
        name: 'thumb drag 100 moves',
        run: (ctx) => drag(thumb(), 0, 150, 100, ctx.lib.flush),
        settle: true,
        verify: summary,
      },
      {
        name: 'add 500 rows',
        run: (ctx) => ctx.lib.set('rows', 1500),
        settle: true,
        verify: summary,
      },
      {
        name: 'hover show/hide',
        run: async (ctx) => {
          const root = q('[data-testid="scroll-root"]');
          hover(root);
          ctx.lib.flush();
          await nextPaint();
          unhover(root);
        },
        settle: true,
        verify: () => q('[data-testid="scrollbar"]').hasAttribute('data-hovering'),
      },
    ],
  },
];

export default scenarios;
