import { click, highlightedText, hover, key, nextPaint, q, qa, yieldTask } from '../drivers';
import type { Scenario, Step, StepContext } from '../types';

const menus = () => qa('[role="menu"]');
const items = () => qa('[role="menuitem"]');
const openMenus = () => menus().length;

async function frames(count: number) {
  for (let i = 0; i < count; i += 1) await nextPaint();
}

async function keys(ctx: StepContext, name: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    key(name);
    ctx.lib.flush();
    await yieldTask();
  }
}

const openStep: Step = {
  name: 'open',
  run: (ctx) => ctx.lib.set('open', true),
  settle: true,
  verify: () => ({ menus: openMenus(), items: items().length }),
};

const checked = (kind: string) =>
  qa(`[data-kind="${kind}"]`)
    .filter((el) => el.getAttribute('aria-checked') === 'true')
    .map((el) => el.textContent?.trim());

/** Submenu triggers at `level`, in DOM order. */
const levelTriggers = (level: number) => qa(`[data-level="${level}"]`);

const scenarios: Scenario[] = [
  {
    id: 'menu/500',
    fixture: 'menu/500',
    steps: [
      openStep,
      {
        name: 'nav x50',
        run: (ctx) => keys(ctx, 'ArrowDown', 50),
        verify: () => highlightedText(),
      },
      {
        name: 'typeahead',
        run: async (ctx) => {
          for (const char of 'Item 4') {
            key(char);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => highlightedText(),
      },
      {
        name: 'hover sweep 100',
        run: async (ctx) => {
          const all = items();
          for (let i = 100; i < 200; i += 1) {
            hover(all[i]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => highlightedText(),
      },
      {
        name: 'click item',
        run: () => click(items()[250]),
        settle: true,
        verify: () => ({ menus: openMenus() }),
      },
      {
        name: 'open by keyboard',
        run: (ctx) => {
          q('[data-testid="trigger"]').focus();
          key('ArrowDown');
          ctx.lib.flush();
        },
        settle: true,
        verify: () => ({ menus: openMenus(), highlighted: highlightedText() }),
      },
      {
        name: 'escape',
        run: (ctx) => {
          key('Escape');
          ctx.lib.flush();
        },
        settle: true,
        verify: () => ({ menus: openMenus() }),
      },
    ],
  },
  {
    id: 'menu/checkbox-radio',
    fixture: 'menu/checkbox-radio',
    steps: [
      openStep,
      {
        name: 'toggle checkbox x50',
        run: async (ctx) => {
          const all = qa('[data-kind="check"]');
          for (let i = 0; i < 50; i += 1) {
            click(all[i * 2]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => ({ menus: openMenus(), checked: checked('check').length }),
      },
      {
        name: 'radio x50',
        run: async (ctx) => {
          const all = qa('[data-kind="radio"]');
          for (let i = 1; i <= 50; i += 1) {
            click(all[i]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => ({ menus: openMenus(), checked: checked('radio') }),
      },
    ],
  },
  {
    id: 'menu/submenus',
    fixture: 'menu/submenus',
    steps: [
      openStep,
      {
        name: 'hover open 3 levels',
        run: async (ctx) => {
          for (let level = 1; level <= 3; level += 1) {
            hover(levelTriggers(level)[0]);
            ctx.lib.flush();
            await frames(2);
          }
        },
        verify: () => ({ menus: openMenus() }),
      },
      {
        name: 'arrow left x2',
        run: (ctx) => keys(ctx, 'ArrowLeft', 2),
        settle: true,
        verify: () => ({ menus: openMenus() }),
      },
      {
        name: 'arrow right',
        run: (ctx) => keys(ctx, 'ArrowRight', 1),
        settle: true,
        verify: () => ({ menus: openMenus() }),
      },
      {
        name: 'hover across 20 triggers',
        run: async (ctx) => {
          for (const trigger of levelTriggers(1)) {
            hover(trigger);
            ctx.lib.flush();
            await frames(1);
          }
        },
        settle: true,
        verify: () => ({
          menus: openMenus(),
          expanded: levelTriggers(1)
            .filter((el) => el.getAttribute('aria-expanded') === 'true')
            .map((el) => el.textContent?.trim()),
        }),
      },
    ],
  },
  { id: 'menu/many-roots-500', fixture: 'menu/many-roots', steps: [] },
];

export default scenarios;
