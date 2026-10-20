// Raw floors for a list's highlight (`*/fixtures/raw-list.tsx`): mount, the first move of the active
// index, then moves one at a time as arrow keys make them, each committed before the next.
import { qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const highlighted = () => qa('[role="option"][data-highlighted]').map((el) => el.textContent);

const steps: Scenario['steps'] = [
  { name: 'first move', run: (ctx) => ctx.lib.set('active', 0), settle: true, verify: highlighted },
  {
    name: 'move x50',
    run: async (ctx) => {
      for (let i = 1; i <= 50; i += 1) {
        ctx.lib.set('active', i);
        ctx.lib.flush();
        await yieldTask();
      }
    },
    verify: highlighted,
  },
  { name: 'clear', run: (ctx) => ctx.lib.set('active', -1), settle: true, verify: highlighted },
];

const scenarios: Scenario[] = ['direct', 'keyed', 'library'].map((mechanism) => ({
  id: `select/raw-list-1000-${mechanism}`,
  fixture: `select/raw-list-1000-${mechanism}`,
  components: ['select'],
  tags: ['scale-1000', 'controlled', 'keyboard', 'raw'],
  steps,
}));

export default scenarios;
