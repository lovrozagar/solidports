import { click, key, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const state = () => ({
  checked: qa('[role="radio"][aria-checked="true"]').map((el) => el.getAttribute('data-v')),
  focused: document.activeElement?.getAttribute('data-v') ?? null,
});

const scenarios: Scenario[] = [
  {
    id: 'radio/300',
    fixture: 'radio/300',
    steps: [
      { name: 'click 1', run: () => click(qa('[role="radio"]')[150]), verify: state },
      {
        name: 'click 100',
        run: async (ctx) => {
          const all = qa('[role="radio"]');
          for (let i = 0; i < 100; i += 1) {
            click(all[i * 3]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: state,
      },
      {
        name: 'ArrowDown x50',
        run: async (ctx) => {
          qa('[role="radio"][aria-checked="true"]')[0].focus();
          for (let i = 0; i < 50; i += 1) {
            key('ArrowDown');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: state,
      },
      { name: 'controlled value', run: (ctx) => ctx.lib.set('value', 'item-5'), verify: state },
    ],
  },
];

export default scenarios;
