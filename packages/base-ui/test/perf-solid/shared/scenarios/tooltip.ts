import { hover, qa, unhover, yieldTask } from '../drivers';
import type { Scenario, Step } from '../types';

const summary = () => ({
  open: qa('[data-testid="tooltip-popup"]').map((el) => el.textContent?.trim()),
});

const sweep = (selector: string): Step => ({
  name: 'hover across 50',
  run: async (ctx) => {
    const triggers = qa(selector);
    for (let i = 0; i < 50; i += 1) {
      if (i > 0) unhover(triggers[i - 1]);
      hover(triggers[i]);
      ctx.lib.flush();
      await yieldTask();
    }
  },
  settle: true,
  verify: summary,
});

const scenarios: Scenario[] = [
  {
    id: 'tooltip/roots-500',
    fixture: 'tooltip/roots',
    steps: [
      {
        name: 'hover open one',
        run: () => hover(qa('[data-testid="tooltip-trigger"]')[0]),
        settle: true,
        verify: summary,
      },
      {
        name: 'leave',
        run: () => unhover(qa('[data-testid="tooltip-trigger"]')[0]),
        settle: true,
        verify: summary,
      },
      sweep('[data-testid="tooltip-trigger"]'),
    ],
  },
  {
    id: 'tooltip/handle-500',
    fixture: 'tooltip/handle',
    steps: [sweep('[data-testid="tooltip-trigger"]')],
  },
];

export default scenarios;
