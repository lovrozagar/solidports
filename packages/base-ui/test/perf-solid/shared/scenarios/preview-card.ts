import { hover, qa, unhover, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const summary = () => ({
  open: qa('[data-testid="card-popup"]').map((el) => el.textContent?.trim()),
});

const scenarios: Scenario[] = [
  {
    id: 'preview-card/roots-200',
    fixture: 'preview-card/roots',
    steps: [
      {
        name: 'hover open',
        run: () => hover(qa('[data-testid="card-trigger"]')[0]),
        settle: true,
        verify: summary,
      },
      {
        name: 'move across 20',
        run: async (ctx) => {
          const triggers = qa('[data-testid="card-trigger"]');
          for (let i = 1; i <= 20; i += 1) {
            unhover(triggers[i - 1]);
            hover(triggers[i]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'leave',
        run: () => unhover(qa('[data-testid="card-trigger"]')[20]),
        settle: true,
        verify: summary,
      },
    ],
  },
];

export default scenarios;
