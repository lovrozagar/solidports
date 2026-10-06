import { click, highlightedText, hover, key, q, qa, yieldTask } from '../drivers';
import type { StepContext } from '../types';
import type { Scenario, Step } from '../types';

const listbox = () => document.querySelector('[role="listbox"]');
const options = () => qa('[role="option"]');

const openStep: Step = {
  name: 'open',
  run: (ctx) => ctx.lib.set('open', true),
  settle: true,
  verify: () => ({ open: !!listbox(), options: options().length }),
};
const closeStep: Step = {
  name: 'close',
  run: (ctx) => ctx.lib.set('open', false),
  settle: true,
  verify: () => ({ open: !!listbox() }),
};

const scenarios: Scenario[] = [
  {
    id: 'select/1000',
    fixture: 'select/1000',
    steps: [
      openStep,
      {
        name: 'nav x50',
        run: async (ctx) => {
          for (let i = 0; i < 50; i += 1) {
            key('ArrowDown');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => highlightedText(),
      },
      {
        name: 'hover sweep 100',
        run: async (ctx) => {
          const all = options();
          for (let i = 100; i < 200; i += 1) {
            hover(all[i]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => highlightedText(),
      },
      {
        name: 'typeahead',
        run: async (ctx) => {
          for (const char of 'Item 7') {
            key(char);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => highlightedText(),
      },
      closeStep,
      openStep,
      {
        name: 'select by click',
        run: () => click(options()[500]),
        settle: true,
        verify: () => ({ open: !!listbox(), value: q('[data-testid="value"]').textContent }),
      },
    ],
  },
];

// Helpers for the full matrix (scoped to this file: shared drivers are not edited by groups).
const keys = async (ctx: StepContext, name: string, count: number) => {
  for (let i = 0; i < count; i += 1) {
    key(name);
    ctx.lib.flush();
    await yieldTask();
  }
};
const trigger = () => q('[data-testid="trigger"]');
const value = () => q('[data-testid="value"]').textContent?.trim() ?? null;
const selectedCount = () => qa('[role="option"][aria-selected="true"]').length;
const openState = () => ({ open: !!listbox(), highlighted: highlightedText() });
const popup = () => q('[data-testid="popup"]');

scenarios.push(
  {
    id: 'select/full-1000',
    fixture: 'select/full-1000',
    steps: [
      { name: 'open by click', run: () => click(trigger()), settle: true, verify: openState },
      { name: 'close by Escape', run: () => key('Escape'), settle: true, verify: openState },
      {
        name: 'open by ArrowDown',
        run: () => {
          trigger().focus();
          key('ArrowDown', trigger());
        },
        settle: true,
        verify: openState,
      },
      { name: 'nav x50', run: (ctx) => keys(ctx, 'ArrowDown', 50), verify: highlightedText },
      { name: 'End', run: (ctx) => keys(ctx, 'End', 1), verify: highlightedText },
      { name: 'Home', run: (ctx) => keys(ctx, 'Home', 1), verify: highlightedText },
      {
        name: 'hover sweep 100',
        run: async (ctx) => {
          const all = options();
          for (let i = 0; i < 100; i += 1) {
            hover(all[i]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: highlightedText,
      },
      {
        name: 'typeahead "Item 75"',
        run: async (ctx) => {
          for (const char of 'Item 75') {
            key(char);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        // Positioning and scroll-into-view settle before the next step scrolls the popup.
        settle: true,
        verify: highlightedText,
      },
      {
        name: 'scroll 20 steps',
        run: async (ctx) => {
          const element = popup();
          for (let i = 0; i < 20; i += 1) {
            element.scrollTop += 150;
            element.dispatchEvent(new Event('scroll'));
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ open: !!listbox(), scrolled: popup().scrollTop > 0 }),
      },
      {
        name: 'select by Enter',
        run: () => key('Enter'),
        settle: true,
        verify: () => ({ open: !!listbox(), value: value() }),
      },
      {
        name: 'open/close x20',
        run: async (ctx) => {
          for (let i = 0; i < 20; i += 1) {
            ctx.lib.set('open', true);
            await yieldTask();
            ctx.lib.set('open', false);
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ open: !!listbox() }),
      },
      { name: 'reopen', run: (ctx) => ctx.lib.set('open', true), settle: true, verify: openState },
      {
        name: 'select item 500 by click',
        run: () => click(options()[500]),
        settle: true,
        verify: () => ({ open: !!listbox(), value: value() }),
      },
    ],
  },
  {
    id: 'select/preselected-800',
    fixture: 'select/preselected-800',
    steps: [
      {
        name: 'open (scroll selected into view)',
        run: (ctx) => ctx.lib.set('open', true),
        settle: true,
        verify: () => ({
          open: !!listbox(),
          selected: qa('[role="option"][aria-selected="true"]').map((el) => el.textContent?.trim()),
          scrolled: popup().scrollTop > 0,
          side: popup().getAttribute('data-side'),
        }),
      },
      {
        name: 'close',
        run: (ctx) => ctx.lib.set('open', false),
        settle: true,
        verify: () => !!listbox(),
      },
    ],
  },
  {
    id: 'select/multiple-1000',
    fixture: 'select/multiple-1000',
    steps: [
      {
        name: 'open',
        run: (ctx) => ctx.lib.set('open', true),
        settle: true,
        verify: () => !!listbox(),
      },
      {
        name: 'toggle 50 by click',
        run: async (ctx) => {
          const all = options();
          for (let i = 0; i < 50; i += 1) {
            click(all[i * 3]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ open: !!listbox(), selected: selectedCount(), value: value() }),
      },
      {
        name: 'untoggle 10',
        run: async (ctx) => {
          const all = options();
          for (let i = 0; i < 10; i += 1) {
            click(all[i * 3]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ selected: selectedCount(), value: value() }),
      },
    ],
  },
);

export default scenarios;
