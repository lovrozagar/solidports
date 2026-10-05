import { click, q, qa, type, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const controls = () => qa<HTMLInputElement>('[data-testid="form"] input[data-testid^="c"]');
const summary = () => ({
  touched: controls().filter((c) => c.hasAttribute('data-touched')).length,
  invalid: controls().filter((c) => c.hasAttribute('data-invalid')).length,
  errors: qa('[data-testid="form"] [data-testid="error"]')
    .map((e) => e.textContent?.trim())
    .filter(Boolean).length,
  firstError:
    q('[data-testid="form"]').querySelector('[data-testid="error"]')?.textContent?.trim() ?? null,
});

const scenarios: Scenario[] = [
  {
    id: 'form/50-fields',
    fixture: 'form/50',
    steps: [
      {
        name: 'tab through 50',
        run: async (ctx) => {
          for (const control of controls()) {
            control.focus();
            ctx.lib.flush();
            await yieldTask();
          }
          (document.activeElement as HTMLElement | null)?.blur();
        },
        verify: summary,
      },
      {
        name: 'submit invalid',
        run: () => click(q('[data-testid="submit"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'fix one',
        run: (ctx) => type(controls()[0], 'ok', ctx.lib.flush),
        settle: true,
        verify: summary,
      },
      {
        name: 'server errors',
        run: (ctx) =>
          ctx.lib.set(
            'errors',
            Object.fromEntries(
              Array.from({ length: 10 }, (_, i) => [`f${i * 5}`, `Server error ${i}`]),
            ),
          ),
        settle: true,
        verify: summary,
      },
    ],
  },
];

export default scenarios;
