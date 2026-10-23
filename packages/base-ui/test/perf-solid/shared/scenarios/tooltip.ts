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
      if (i > 0) {
        unhover(triggers[i - 1]);
      }
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
    components: ['tooltip'],
    tags: ['scale-100', 'uncontrolled', 'pointer', 'open', 'close', 'portal'],
    steps: [
      {
        name: 'hover open one',
        firstOpen: true,
        run: () => hover(qa('[data-testid="tooltip-trigger"]')[0]),
        settle: true,
        verify: summary,
      },
      {
        name: 'leave',
        run: () => unhover(qa('[data-testid="tooltip-trigger"]')[0]),
        settle: true,
        // The pointer leaves away from the popup, outside safePolygon's polygon, so the tooltip
        // closes at once: no timer runs on this path (a declared 40 ms read as -38 ms in regate c).
        until: () => qa('[data-testid="tooltip-popup"]').length === 0,
        timerMs: 0,
        verify: summary,
      },
      { ...sweep('[data-testid="tooltip-trigger"]'), firstOpen: true },
    ],
  },
  {
    id: 'tooltip/handle-500',
    fixture: 'tooltip/handle',
    components: ['tooltip'],
    tags: ['scale-100', 'uncontrolled', 'pointer', 'open', 'close', 'portal'],
    steps: [{ ...sweep('[data-testid="tooltip-trigger"]'), firstOpen: true }],
  },
];

export default scenarios;
