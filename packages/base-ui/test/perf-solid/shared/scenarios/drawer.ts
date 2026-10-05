import { click, key, nextPaint, q, qa, yieldTask } from '../drivers';
import type { Scenario, Step } from '../types';

const summary = () => ({ open: qa('[role="dialog"]').length });

/** A touch swipe on `element` by `dx`: every pointer event targets the element, as a real touch does. */
async function swipe(element: Element, dx: number, moves: number, flush: () => void) {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const init = (clientX: number, buttons: number): PointerEventInit => ({
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 2,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons,
    clientX,
    clientY: y,
  });
  element.dispatchEvent(new PointerEvent('pointerdown', init(x, 1)));
  for (let i = 1; i <= moves; i += 1) {
    element.dispatchEvent(new PointerEvent('pointermove', init(x + (dx * i) / moves, 1)));
    flush();
    await yieldTask();
  }
  element.dispatchEvent(new PointerEvent('pointerup', init(x + dx, 0)));
}

const open: Step = {
  name: 'open via trigger',
  run: () => click(q('[data-testid="drawer-trigger"]')),
  settle: true,
  verify: summary,
};

const scenarios: Scenario[] = [
  {
    id: 'drawer/content-500',
    fixture: 'drawer/content',
    steps: [
      open,
      { name: 'close via Escape', run: () => key('Escape'), settle: true, verify: summary },
      open,
      {
        name: 'open nested',
        run: () => click(q('[data-testid="nested-drawer-trigger"]')),
        settle: true,
        verify: summary,
      },
      { name: 'close nested', run: () => key('Escape'), settle: true, verify: summary },
      { name: 'close', run: () => key('Escape'), settle: true, verify: summary },
      {
        name: 'open/close x20',
        run: async (ctx) => {
          for (let i = 0; i < 20; i += 1) {
            click(q('[data-testid="drawer-trigger"]'));
            ctx.lib.flush();
            await nextPaint();
            key('Escape');
            ctx.lib.flush();
            await nextPaint();
          }
        },
        settle: true,
        verify: summary,
      },
      open,
      {
        name: 'swipe back (snap)',
        run: (ctx) => swipe(q('[data-testid="drawer-popup"]'), 20, 60, ctx.lib.flush),
        settle: true,
        verify: summary,
      },
      {
        name: 'swipe to dismiss',
        run: (ctx) => swipe(q('[data-testid="drawer-popup"]'), 400, 60, ctx.lib.flush),
        settle: true,
        verify: summary,
      },
    ],
  },
];

export default scenarios;
