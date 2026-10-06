import { click, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const on = () => qa('[role="switch"]').filter((el) => el.getAttribute('aria-checked') === 'true').length;

const scenarios: Scenario[] = [
  { id: 'switch/raw-1000', fixture: 'switch/raw', steps: [] },
  {
    id: 'switch/1000',
    fixture: 'switch/1000',
    steps: [
      { name: 'click 1', run: () => click(qa('[role="switch"]')[500]), verify: on },
      {
        name: 'click 100',
        run: async (ctx) => {
          const all = qa('[role="switch"]');
          for (let i = 0; i < 100; i += 1) {
            click(all[i * 10]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: on,
      },
    ],
  },
];

export default scenarios;
