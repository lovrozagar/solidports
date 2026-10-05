import { click, hover, nextPaint, q, qa, unhover, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const popups = () => qa('[data-testid="popover-popup"]');
const summary = () => ({
  open: popups().length,
  expanded: qa('[aria-expanded="true"]').map((el) => el.textContent?.trim()),
});

const scenarios: Scenario[] = [
  {
    id: 'popover/content-200',
    fixture: 'popover/content',
    steps: [
      {
        name: 'open by click',
        run: () => click(q('[data-testid="popover-trigger"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'scroll page x50',
        run: async () => {
          for (let i = 0; i < 50; i += 1) {
            window.scrollBy(0, 10);
            await nextPaint();
          }
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'close by click',
        run: () => click(q('[data-testid="popover-trigger"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'hover open',
        run: () => hover(q('[data-testid="hover-trigger"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'hover leave',
        run: () => unhover(q('[data-testid="hover-trigger"]')),
        settle: true,
        verify: summary,
      },
    ],
  },
  { id: 'popover/roots-500', fixture: 'popover/roots', steps: [] },
  {
    id: 'popover/handle-20',
    fixture: 'popover/handle',
    steps: [
      {
        name: 'switch triggers x20',
        run: async (ctx) => {
          const triggers = qa('[data-testid="handle-trigger"]');
          for (let i = 0; i < 20; i += 1) {
            click(triggers[i]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: summary,
      },
    ],
  },
];

export default scenarios;
