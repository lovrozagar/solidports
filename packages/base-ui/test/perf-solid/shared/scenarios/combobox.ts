import {
  click,
  highlightedText,
  hover,
  key,
  q,
  qa,
  setInputValue,
  type,
  yieldTask,
} from '../drivers';
import type { StepContext } from '../types';
import type { Scenario } from '../types';

const rows = () => qa('[role="option"]').length;
const input = () => q<HTMLInputElement>('[data-testid="input"]');

const scenarios: Scenario[] = [
  {
    id: 'combobox/1000',
    fixture: 'combobox/1000',
    steps: [
      { name: 'open', run: (ctx) => ctx.lib.set('open', true), settle: true, verify: rows },
      {
        name: 'type "item 5"',
        run: (ctx) => type(input(), 'item 5', ctx.lib.flush),
        settle: true,
        verify: rows,
      },
      {
        name: 'clear',
        run: () => setInputValue(input(), ''),
        settle: true,
        verify: rows,
      },
      { name: 'close', run: (ctx) => ctx.lib.set('open', false), settle: true, verify: rows },
    ],
  },
];

// Helpers for the full matrix (scoped to this file).
const keys = async (ctx: StepContext, name: string, count: number) => {
  for (let i = 0; i < count; i += 1) {
    key(name);
    ctx.lib.flush();
    await yieldTask();
  }
};
const options = () => qa('[role="option"]');
const listbox = () => document.querySelector('[role="listbox"]');
const view = () => ({
  open: !!listbox(),
  rows: rows(),
  input: input().value,
  empty: !!document.querySelector('[data-testid="empty"]'),
  highlighted: highlightedText(),
});
const backspaceAll = async (ctx: StepContext) => {
  const element = input();
  while (element.value.length > 0) {
    key('Backspace', element);
    setInputValue(element, element.value.slice(0, -1));
    ctx.lib.flush();
    await yieldTask();
  }
};
const chips = () => qa('[data-testid="chip"]').length;

scenarios.push(
  {
    id: 'combobox/full-1000',
    fixture: 'combobox/full-1000',
    steps: [
      {
        name: 'open by trigger',
        run: () => click(q('[data-testid="trigger"]')),
        settle: true,
        verify: view,
      },
      {
        name: 'type "item 5"',
        run: (ctx) => type(input(), 'item 5', ctx.lib.flush),
        settle: true,
        verify: view,
      },
      { name: 'backspace to empty', run: backspaceAll, settle: true, verify: view },
      {
        name: 'paste "Item 99"',
        run: () => setInputValue(input(), 'Item 99'),
        settle: true,
        verify: view,
      },
      {
        name: 'no match "zzz"',
        run: () => setInputValue(input(), 'zzz'),
        settle: true,
        verify: view,
      },
      { name: 'clear', run: () => setInputValue(input(), ''), settle: true, verify: view },
      { name: 'nav x50', run: (ctx) => keys(ctx, 'ArrowDown', 50), verify: view },
      { name: 'End', run: (ctx) => keys(ctx, 'End', 1), verify: view },
      { name: 'Home', run: (ctx) => keys(ctx, 'Home', 1), verify: view },
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
        verify: view,
      },
      { name: 'select by Enter', run: () => key('Enter', input()), settle: true, verify: view },
      {
        name: 'reopen',
        run: () => click(q('[data-testid="trigger"]')),
        settle: true,
        verify: view,
      },
      {
        name: 'select row 500 by click',
        run: () => click(options()[500]),
        settle: true,
        verify: view,
      },
      { name: 'reopen again', run: (ctx) => ctx.lib.set('open', true), settle: true, verify: view },
      {
        name: 'replace items while open',
        run: (ctx) =>
          ctx.lib.set(
            'items',
            Array.from({ length: 1000 }, (_, i) => ({ value: `next-${i}`, label: `Next ${i}` })),
          ),
        settle: true,
        verify: view,
      },
      { name: 'close by Escape', run: () => key('Escape', input()), settle: true, verify: view },
    ],
  },
  {
    id: 'combobox/5000',
    fixture: 'combobox/5000',
    steps: [
      { name: 'open', run: (ctx) => ctx.lib.set('open', true), settle: true, verify: view },
      {
        name: 'type "item 4"',
        run: (ctx) => type(input(), 'item 4', ctx.lib.flush),
        settle: true,
        verify: view,
      },
      { name: 'clear', run: () => setInputValue(input(), ''), settle: true, verify: view },
      { name: 'close', run: (ctx) => ctx.lib.set('open', false), settle: true, verify: view },
    ],
  },
  {
    id: 'combobox/multiple-1000',
    fixture: 'combobox/multiple-1000',
    steps: [
      {
        name: 'open',
        run: (ctx) => ctx.lib.set('open', true),
        settle: true,
        verify: () => ({ open: !!listbox(), chips: chips() }),
      },
      {
        name: 'select 50 by click',
        run: async (ctx) => {
          for (let i = 0; i < 50; i += 1) {
            click(options()[i * 2]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ open: !!listbox(), chips: chips() }),
      },
      {
        name: 'remove 10 chips',
        run: async (ctx) => {
          for (let i = 0; i < 10; i += 1) {
            click(q('[data-testid="chip-remove"]'));
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => ({ chips: chips() }),
      },
      {
        name: 'Backspace removes last chip',
        run: () => {
          input().focus();
          key('Backspace', input());
        },
        settle: true,
        verify: () => ({ chips: chips() }),
      },
    ],
  },
);

export default scenarios;
