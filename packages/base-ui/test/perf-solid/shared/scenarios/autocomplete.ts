import { highlightedText, key, q, qa, setInputValue, type, yieldTask } from '../drivers';
import type { Scenario, StepContext } from '../types';

const input = () => q<HTMLInputElement>('[data-testid="input"]');
const view = () => ({
  open: !!document.querySelector('[role="listbox"]'),
  rows: qa('[role="option"]').length,
  input: input().value,
  empty: !!document.querySelector('[data-testid="empty"]'),
  highlighted: highlightedText(),
});
const keys = async (ctx: StepContext, name: string, count: number) => {
  for (let i = 0; i < count; i += 1) {
    key(name, input());
    ctx.lib.flush();
    await yieldTask();
  }
};

const scenarios: Scenario[] = [
  {
    id: 'autocomplete/1000',
    fixture: 'autocomplete/1000',
    steps: [
      {
        name: 'type "Item 5"',
        run: (ctx) => type(input(), 'Item 5', ctx.lib.flush),
        settle: true,
        verify: view,
      },
      { name: 'nav x50', run: (ctx) => keys(ctx, 'ArrowDown', 50), verify: view },
      {
        name: 'Enter fills input',
        run: (ctx) => keys(ctx, 'Enter', 1),
        settle: true,
        verify: view,
      },
      { name: 'clear', run: () => setInputValue(input(), ''), settle: true, verify: view },
      {
        name: 'type "Item 1"',
        run: (ctx) => type(input(), 'Item 1', ctx.lib.flush),
        settle: true,
        verify: view,
      },
      { name: 'Escape', run: (ctx) => keys(ctx, 'Escape', 1), settle: true, verify: view },
    ],
  },
  {
    id: 'autocomplete/both-1000',
    fixture: 'autocomplete/both-1000',
    steps: [
      {
        name: 'type "Item 12"',
        run: (ctx) => type(input(), 'Item 12', ctx.lib.flush),
        settle: true,
        verify: view,
      },
      { name: 'nav x10 (inline fill)', run: (ctx) => keys(ctx, 'ArrowDown', 10), verify: view },
      { name: 'Escape restores', run: (ctx) => keys(ctx, 'Escape', 1), settle: true, verify: view },
    ],
  },
];

export default scenarios;
