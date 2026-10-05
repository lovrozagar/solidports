import { click, key, nextPaint, q, qa, yieldTask } from '../drivers';
import type { Scenario, Step, StepContext } from '../types';

const dialogs = () => qa('[role="dialog"]');
const active = () => document.activeElement?.textContent?.trim() ?? null;
const summary = () => ({ open: dialogs().length, focused: active() });

const openByTrigger: Step = {
  name: 'open via trigger',
  run: () => click(q('[data-testid="dialog-trigger"]')),
  settle: true,
  verify: summary,
};

/** One open/close cycle through real input, settled between, as a user toggling the dialog. */
async function cycle(ctx: StepContext, close: () => void) {
  click(q('[data-testid="dialog-trigger"]'));
  ctx.lib.flush();
  await nextPaint();
  close();
  ctx.lib.flush();
  await nextPaint();
}

const scenarios: Scenario[] = [
  {
    id: 'dialog/content-500',
    fixture: 'dialog/content',
    steps: [
      openByTrigger,
      { name: 'close via Escape', run: () => key('Escape'), settle: true, verify: summary },
      openByTrigger,
      {
        name: 'close via Close',
        run: () => click(q('[data-testid="dialog-close"]')),
        settle: true,
        verify: summary,
      },
      openByTrigger,
      {
        name: 'close via backdrop',
        run: () => click(q('[data-testid="dialog-backdrop"]')),
        settle: true,
        verify: summary,
      },
      openByTrigger,
      {
        name: 'open nested',
        run: () => click(q('[data-testid="nested-trigger"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'close nested via Escape',
        run: async (ctx) => {
          key('Escape');
          ctx.lib.flush();
          await yieldTask();
        },
        settle: true,
        verify: summary,
      },
      { name: 'close via Escape', run: () => key('Escape'), settle: true, verify: summary },
      {
        name: 'open/close x20',
        run: async (ctx) => {
          for (let i = 0; i < 20; i += 1) await cycle(ctx, () => key('Escape'));
        },
        settle: true,
        verify: summary,
      },
    ],
  },
  { id: 'dialog/roots-200', fixture: 'dialog/roots', steps: [] },
];

export default scenarios;
