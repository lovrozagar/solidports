import { hover, q, qa, unhover, yieldTask } from '../drivers';
import type { Scenario } from '../types';

/** The fixture's toast manager (`Toast.createToastManager()`), set on `window` by both apps. */
interface Manager {
  add(options: { title: string; description?: string }): string;
  update(id: string, updates: { title: string }): void;
  close(id?: string): void;
  promise(
    promise: Promise<string>,
    options: { loading: string; success: (value: string) => string; error: string },
  ): Promise<string>;
}
const manager = () => (window as unknown as { __benchToast: Manager }).__benchToast;
let ids: string[] = [];

const toasts = () => qa('[data-testid="toast"]');
const summary = () => ({
  count: toasts().length,
  titles: toasts()
    .map((el) => el.querySelector('[data-testid="toast-title"]')?.textContent ?? '')
    .slice(0, 3),
  expanded: q('[data-testid="viewport"]').hasAttribute('data-expanded'),
});

const scenarios: Scenario[] = [
  {
    id: 'toast/50',
    fixture: 'toast/viewport',
    steps: [
      {
        name: 'add 50',
        run: async (ctx) => {
          ids = [];
          for (let i = 0; i < 50; i += 1) {
            ids.push(manager().add({ title: `Toast ${i}`, description: 'Body' }));
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'update 50',
        run: async (ctx) => {
          for (const [i, id] of ids.entries()) {
            manager().update(id, { title: `Updated ${i}` });
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'hover expands',
        run: () => hover(q('[data-testid="viewport"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'leave',
        run: () => unhover(q('[data-testid="viewport"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'dismiss 50',
        run: async (ctx) => {
          for (const id of ids) {
            manager().close(id);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'add/dismiss interleaved x100',
        run: async (ctx) => {
          let previous: string | undefined;
          for (let i = 0; i < 100; i += 1) {
            const id = manager().add({ title: `Toast ${i}` });
            if (previous) manager().close(previous);
            previous = id;
            ctx.lib.flush();
            await yieldTask();
          }
          if (previous) manager().close(previous);
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'promise x20',
        run: async (ctx) => {
          const pending = Array.from({ length: 20 }, (_, i) =>
            manager().promise(Promise.resolve(`Done ${i}`), {
              loading: 'Loading',
              success: (value) => value,
              error: 'Failed',
            }),
          );
          ctx.lib.flush();
          await Promise.all(pending);
          ctx.lib.flush();
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'dismiss all',
        run: () => manager().close(),
        settle: true,
        verify: summary,
      },
    ],
  },
];

export default scenarios;
