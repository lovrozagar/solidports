import { click, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const expanded = () => qa('[aria-expanded="true"]').length;

const scenarios: Scenario[] = [
  {
    id: 'collapsible/300',
    fixture: 'collapsible/300',
    steps: [
      { name: 'open all', run: (ctx) => ctx.lib.set('open', true), settle: true, verify: expanded },
      { name: 'close all', run: (ctx) => ctx.lib.set('open', false), settle: true, verify: expanded },
    ],
  },
  {
    id: 'collapsible/300-uncontrolled',
    fixture: 'collapsible/300-uncontrolled',
    steps: [
      { name: 'click 1', run: () => click(qa('[aria-expanded]')[150]), settle: true, verify: expanded },
      {
        name: 'click 100',
        run: async (ctx) => {
          const triggers = qa('[aria-expanded]');
          for (let i = 0; i < 100; i += 1) {
            click(triggers[i * 3]);
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
