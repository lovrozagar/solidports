import { click, nextPaint, q, qa, type, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const count = (selector: string) => () => qa(selector).length;

async function until(predicate: () => boolean, frames = 120) {
  for (let i = 0; i < frames && !predicate(); i += 1) {
    await nextPaint();
  }
}

const scenarios: Scenario[] = [
  { id: 'static/button-nonnative-1000', fixture: 'static/button-nonnative', steps: [], verifyMount: count('[role="button"]') },
  { id: 'static/button-render-fn-1000', fixture: 'static/button-render-fn', steps: [], verifyMount: count('[role="button"]') },
  {
    id: 'static/avatar-1000',
    fixture: 'static/avatar',
    steps: [
      {
        name: 'images load',
        run: () => until(() => qa('img').length === 1000),
        verify: () => ({ img: qa('img').length, fallback: qa('[data-testid="fallback"]').length }),
      },
      {
        name: 'break src → fallback',
        run: async (ctx) => {
          ctx.lib.set('src', 'data:image/png;base64,broken');
          await until(() => qa('[data-testid="fallback"]').length === 1000);
        },
        verify: () => ({ img: qa('img').length, fallback: qa('[data-testid="fallback"]').length }),
      },
    ],
  },
  {
    id: 'static/progress-meter-1000',
    fixture: 'static/progress-meter',
    steps: [
      {
        name: '50 updates',
        run: (ctx) => {
          for (let i = 1; i <= 50; i += 1) ctx.lib.set('value', i);
        },
        verify: () => ({
          progress: q('[role="progressbar"]').getAttribute('aria-valuenow'),
          meter: q('[role="meter"]').getAttribute('aria-valuenow'),
        }),
      },
    ],
  },
  {
    id: 'static/separator-input-1000',
    fixture: 'static/separator-input',
    steps: [
      {
        name: 'type 20 chars',
        run: (ctx) => type(q<HTMLInputElement>('input'), 'abcdefghijklmnopqrst', ctx.lib.flush),
        verify: () => q<HTMLInputElement>('input').value,
      },
    ],
  },
  {
    id: 'static/use-render-1000',
    fixture: 'static/use-render',
    steps: [
      {
        name: 'click 100',
        run: async (ctx) => {
          const buttons = qa('[data-testid="counter"]');
          for (let i = 0; i < 100; i += 1) {
            click(buttons[i * 10]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => qa('[data-odd]').length,
      },
    ],
  },
];

export default scenarios;
