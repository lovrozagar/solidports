import { click, key, q, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const scenarios: Scenario[] = [
  {
    id: 'composition/direction-500',
    fixture: 'composition/direction',
    steps: [
      { name: 'switch to rtl', run: (ctx) => ctx.lib.set('direction', 'rtl'), verify: () => q('[data-testid="dir"]').getAttribute('dir') },
      {
        name: 'ArrowLeft x20 (rtl forward)',
        run: async (ctx) => {
          qa('button[aria-pressed]')[0].focus();
          for (let i = 0; i < 20; i += 1) {
            key('ArrowLeft');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => document.activeElement?.textContent ?? null,
      },
    ],
  },
  {
    id: 'composition/csp-100',
    fixture: 'composition/csp',
    steps: [],
    verifyMount: () => ({ styles: qa('style').length, nonced: qa('style[nonce]').length }),
  },
  {
    id: 'composition/nested-portals',
    fixture: 'composition/nested-portals',
    steps: [
      { name: 'open popover', run: () => click(q('[data-testid="popover-trigger"]')), settle: true, verify: () => qa('[data-testid="popover-popup"]').length },
      { name: 'open dialog', run: () => click(q('[data-testid="dialog-trigger"]')), settle: true, verify: () => qa('[role="dialog"]').length },
      { name: 'open select', run: () => click(q('[data-testid="select-trigger"]')), settle: true, verify: () => qa('[role="option"]').length },
      {
        name: 'escape x3',
        run: async (ctx) => {
          for (let i = 0; i < 3; i += 1) {
            key('Escape');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ options: qa('[role="option"]').length, dialogs: qa('[role="dialog"]').length }),
      },
    ],
  },
  {
    id: 'composition/render-fn-1000',
    fixture: 'composition/render-fn',
    steps: [
      {
        name: 'click 100',
        run: async (ctx) => {
          const all = qa('button[aria-pressed]');
          for (let i = 0; i < 100; i += 1) {
            click(all[i * 10]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => qa('button[aria-pressed]').filter((el) => el.textContent === 'on').length,
      },
    ],
  },
];

export default scenarios;
