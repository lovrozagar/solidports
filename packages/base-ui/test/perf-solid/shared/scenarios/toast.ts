import { click, hover, q, qa, unhover, yieldTask } from '../drivers';
import type { Scenario } from '../types';

/** The fixture's toast manager (`Toast.createToastManager()`), set on `window` by both apps. */
interface Manager {
  add(options: {
    title: string;
    description?: string;
    actionProps?: Record<string, unknown>;
    positionerProps?: Record<string, unknown>;
  }): string;
  update(id: string, updates: { title?: string; actionProps?: Record<string, unknown> }): void;
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

const actions = () =>
  qa('[data-testid="toast-action"]')
    .map((el) => el.textContent ?? '')
    .slice(0, 3);
const arrows = () => ({
  count: qa('[data-testid="toast-arrow"]').length,
  sides: qa('[data-testid="toast-arrow"]')
    .map((el) => el.getAttribute('data-side'))
    .slice(0, 3),
});

const scenarios: Scenario[] = [
  {
    id: 'toast/50',
    fixture: 'toast/viewport',
    components: ['toast'],
    tags: ['scale-100', 'reactive-props', 'pointer'],
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
            if (previous) {
              manager().close(previous);
            }
            previous = id;
            ctx.lib.flush();
            await yieldTask();
          }
          if (previous) {
            manager().close(previous);
          }
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
  {
    // D33 batch 3: each toast's Toast.Action, its content and handler from `actionProps`.
    id: 'toast/50-action',
    fixture: 'toast/viewport-action',
    components: ['toast'],
    tags: ['scale-100', 'reactive-props', 'pointer'],
    steps: [
      {
        name: 'add 50 with actions',
        run: async (ctx) => {
          ids = [];
          for (let i = 0; i < 50; i += 1) {
            const id: string = manager().add({
              title: `Toast ${i}`,
              actionProps: { children: `Undo ${i}`, onClick: () => manager().close(id) },
            });
            ids.push(id);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ ...summary(), actions: actions() }),
      },
      {
        name: 'update 50 actions',
        run: async (ctx) => {
          for (const [i, id] of ids.entries()) {
            manager().update(id, {
              actionProps: { children: `Redo ${i}`, onClick: () => manager().close(id) },
            });
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ ...summary(), actions: actions() }),
      },
      {
        name: 'click 10 actions',
        run: async (ctx) => {
          // Ten different toasts: a closed toast stays in the document until its exit ends.
          for (const button of qa('[data-testid="toast-action"]').slice(0, 10)) {
            click(button);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ ...summary(), actions: actions() }),
      },
      {
        name: 'dismiss all',
        run: () => manager().close(),
        settle: true,
        verify: summary,
      },
    ],
  },
  {
    // D33 batch 3: toasts anchored to a button, each with a Toast.Arrow.
    id: 'toast/anchored-20',
    fixture: 'toast/anchored',
    components: ['toast'],
    tags: ['scale-1', 'reactive-props', 'portal'],
    steps: [
      {
        name: 'add 20 anchored',
        run: async (ctx) => {
          ids = [];
          const anchor = q('[data-testid="toast-anchor"]');
          for (let i = 0; i < 20; i += 1) {
            ids.push(
              manager().add({ title: `Toast ${i}`, positionerProps: { anchor, side: 'top' } }),
            );
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ count: toasts().length, arrows: arrows() }),
      },
      {
        name: 'update 20',
        run: async (ctx) => {
          for (const [i, id] of ids.entries()) {
            manager().update(id, { title: `Updated ${i}` });
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ count: toasts().length, arrows: arrows() }),
      },
      {
        name: 'dismiss all',
        run: () => manager().close(),
        settle: true,
        verify: () => ({ count: toasts().length, arrows: arrows() }),
      },
    ],
  },
];

export default scenarios;
