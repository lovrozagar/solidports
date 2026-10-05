import { click, key, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const expanded = () => qa('[aria-expanded="true"]').length;
const all = () => Array.from({ length: qa('[aria-expanded]').length }, (_, i) => `item-${i}`);

const scenarios: Scenario[] = [
  {
    id: 'accordion/300',
    fixture: 'accordion/300',
    steps: [
      { name: 'open one', run: (ctx) => ctx.lib.set('value', ['item-150']), settle: true, verify: expanded },
      { name: 'open all', run: (ctx) => ctx.lib.set('value', all()), settle: true, verify: expanded },
      { name: 'close all', run: (ctx) => ctx.lib.set('value', []), settle: true, verify: expanded },
      {
        name: 'ArrowDown x50',
        run: async (ctx) => {
          qa('[aria-expanded]')[0].focus();
          for (let i = 0; i < 50; i += 1) {
            key('ArrowDown');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => document.activeElement?.textContent ?? null,
      },
    ],
  },
  {
    id: 'accordion/300-animated',
    fixture: 'accordion/300-animated',
    steps: [
      {
        name: 'toggle x20',
        run: async (ctx) => {
          const trigger = qa('[aria-expanded]')[0];
          for (let i = 0; i < 20; i += 1) {
            click(trigger);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: expanded,
      },
    ],
  },
];

export default scenarios;
