import { click, hover, nextPaint, q, qa, unhover, yieldTask } from '../drivers';
import type { Scenario, StepContext } from '../types';

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
  closeTiming('toast/close-timing', 'toast/viewport'),
  closeTiming('toast/close-timing-exit', 'toast/viewport-exit'),
  closeInteractivity(),
];

/** The longest a trace waits for the closed toast to leave, in tasks. */
const TRACE_TASKS = 2000;

/** What a user can do with a closing toast: its state and its action's, at one task boundary. */
function closingState(toast: HTMLElement, action: HTMLElement) {
  const connected = toast.isConnected;
  const matched = qa('[data-testid="toast-action"]');
  return {
    connected,
    ending: toast.hasAttribute('data-ending-style'),
    starting: toast.hasAttribute('data-starting-style'),
    inert: toast.inert || toast.closest('[inert]') !== null,
    ariaHidden: toast.closest('[aria-hidden="true"]') !== null,
    pointerEvents: connected ? getComputedStyle(action).pointerEvents : null,
    actionMatched: matched.includes(action),
    actionFirst: matched[0] === action,
  };
}

/** `entries` without consecutive repeats: the order of the changes, however many tasks each lasts. */
function changes<T>(entries: T[]) {
  return entries.filter(
    (entry, i) => i === 0 || JSON.stringify(entry) !== JSON.stringify(entries[i - 1]),
  );
}

let trace: Record<string, unknown> = {};

/**
 * Whether a closing toast stays something a user can click, task by task, from its close to its
 * removal (the D33 toast removal-timing leaf). Three toasts with actions that close their own
 * toast; the first action is clicked, then the closing toast's state is read at each task boundary
 * until it leaves. Then a click a task on whatever action is first, the way the old
 * `toast/50-action` step clicked, until the toast closed first leaves: which toasts those clicks
 * reached, as the order of their changes.
 *
 * The summary keeps only what does not depend on the libraries' scheduling: the toasts the clicks
 * reached, whether the first closed toast left, and whether the closing toast stayed clickable and
 * first, never inert and never aria-hidden, until its removal. Notes (5 local runs, 2026-10-24):
 * both libraries keep the closing toast clickable and first until it leaves one frame after the
 * close, and the clicks reach the same toasts. When `data-ending-style` appears differs: Solid
 * sets it in the close's microtask flush, so a task boundary sees the toast connected and ending
 * before it leaves (5 of 5 runs); React sets it when its scheduler renders in a MessageChannel
 * task that races the scenario's own task, and a boundary saw that state in 1 of 5 runs. That
 * order is scheduling, not behavior, so the summary leaves it out.
 */
function closeInteractivity(): Scenario {
  const addThree = async (ctx: StepContext) => {
    ids = [];
    for (let i = 0; i < 3; i += 1) {
      const id: string = manager().add({
        title: `Toast ${i}`,
        actionProps: { children: `Undo ${i}`, onClick: () => manager().close(id) },
      });
      ids.push(id);
      ctx.lib.flush();
      await yieldTask();
    }
  };
  const titleOf = (element: Element) =>
    element.closest('[data-testid="toast"]')?.querySelector('[data-testid="toast-title"]')
      ?.textContent ?? null;
  return {
    id: 'toast/close-interactivity',
    fixture: 'toast/viewport-action',
    components: ['toast'],
    tags: ['scale-1', 'pointer'],
    steps: [
      { name: 'add 3', run: addThree, settle: true, verify: summary },
      {
        name: 'click an action, then read its toast each task until it leaves',
        run: async (ctx) => {
          const action = qa('[data-testid="toast-action"]')[0];
          const toast = action.closest<HTMLElement>('[data-testid="toast"]')!;
          const states = [closingState(toast, action)];
          click(action);
          ctx.lib.flush();
          states.push(closingState(toast, action));
          for (let task = 0; task < TRACE_TASKS && toast.isConnected; task += 1) {
            await yieldTask();
            states.push(closingState(toast, action));
          }
          const mounted = states.filter((state) => state.connected);
          trace = {
            neverInert: states.every((state) => !state.inert),
            neverAriaHidden: states.every((state) => !state.ariaHidden),
            clickableUntilRemoval: mounted.every(
              (state) => state.pointerEvents !== 'none' && state.actionMatched && state.actionFirst,
            ),
            removed: !toast.isConnected,
          };
        },
        settle: true,
        verify: () => ({ ...summary(), ...trace }),
      },
      { name: 'add 3 more', run: addThree, settle: true, verify: summary },
      {
        name: 'click the first action each task until the first closed toast leaves',
        run: async (ctx) => {
          const first = qa('[data-testid="toast"]')[0];
          const hits: (string | null)[] = [];
          for (let task = 0; task < TRACE_TASKS && first.isConnected; task += 1) {
            const action = qa('[data-testid="toast-action"]')[0];
            if (!action) {
              break;
            }
            hits.push(titleOf(action));
            click(action);
            ctx.lib.flush();
            await yieldTask();
          }
          trace = { hits: changes(hits), firstLeft: !first.isConnected };
        },
        settle: true,
        verify: () => ({ ...summary(), ...trace }),
      },
    ],
  };
}

/** When a closed toast left the document, as `closeTiming`'s close step recorded it. */
let removal: Record<string, unknown> = {};

/**
 * When a closed toast leaves the document (the D33 toast removal-timing leaf): one toast is added,
 * then closed, and waited for, with and without an exit animation. The summary keeps whether it
 * was still mounted right after the close's flush, whether it left, and whether its exit ran.
 * Notes (5 local runs each, 2026-10-24): in both libraries the toast was mounted after the flush
 * and after one task, and left 1 frame after the close without an animation, and 1 frame after
 * its `transitionend` with the 60 ms exit, in every run. Frame counts stay out of the summary: a
 * shared runner's frames are not the same from run to run.
 */
function closeTiming(id: string, fixture: string): Scenario {
  return {
    id,
    fixture,
    components: ['toast'],
    tags: ['scale-1', 'open'],
    steps: [
      {
        name: 'add 1',
        run: (ctx) => {
          ids = [manager().add({ title: 'Closing' })];
          ctx.lib.flush();
        },
        settle: true,
        verify: () => ({ count: toasts().length }),
      },
      {
        name: 'close it and wait for its removal',
        run: async (ctx) => {
          const [toast] = toasts();
          let endedAt: number | null = null;
          let frames = 0;
          toast.addEventListener('transitionend', () => {
            endedAt ??= frames;
          });
          manager().close(ids[0]);
          ctx.lib.flush();
          const afterFlush = toast.isConnected;
          while (toast.isConnected && frames < 120) {
            await nextPaint();
            frames += 1;
          }
          // Only what no scheduling moves: a close never removes the toast within its own flush,
          // and the toast leaves. The frame counts are in the notes above.
          removal = {
            mountedAfterFlush: afterFlush,
            removed: !toast.isConnected,
            exitAnimated: endedAt !== null,
          };
        },
        settle: true,
        verify: () => ({ count: toasts().length, ...removal }),
      },
    ],
  };
}

export default scenarios;
