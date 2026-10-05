import { click, nextPaint, q, qa } from '../drivers';
import type { Scenario } from '../types';

const summary = () => ({
  open: qa('[role="alertdialog"]').length,
  focused: document.activeElement?.textContent?.trim() ?? null,
});

const scenarios: Scenario[] = [
  {
    id: 'alert-dialog/content-500',
    fixture: 'alert-dialog/content',
    steps: [
      {
        name: 'open via trigger',
        run: () => click(q('[data-testid="alert-trigger"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'confirm',
        run: () => click(q('[data-testid="alert-confirm"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'open/confirm x20',
        run: async (ctx) => {
          for (let i = 0; i < 20; i += 1) {
            click(q('[data-testid="alert-trigger"]'));
            ctx.lib.flush();
            await nextPaint();
            click(q('[data-testid="alert-confirm"]'));
            ctx.lib.flush();
            await nextPaint();
          }
        },
        settle: true,
        verify: summary,
      },
    ],
  },
];

export default scenarios;
