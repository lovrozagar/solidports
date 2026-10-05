import { click, key, qa, yieldTask } from '../drivers';
import type { Scenario, Step, StepContext } from '../types';

const selected = () => ({
  tab: qa('[role="tab"][aria-selected="true"]').map((el) => el.textContent),
  panels: qa('[role="tabpanel"]').length,
  focused: document.activeElement?.textContent ?? null,
});

async function press(ctx: StepContext, name: string, times: number) {
  for (let i = 0; i < times; i += 1) {
    key(name);
    ctx.lib.flush();
    await yieldTask();
  }
}

const arrowSteps = (forward: string): Step[] => [
  { name: 'click tab 150', run: () => click(qa('[role="tab"]')[150]), settle: true, verify: selected },
  {
    name: `${forward} x50`,
    run: (ctx) => press(ctx, forward, 50),
    settle: true,
    verify: selected,
  },
  { name: 'Home', run: (ctx) => press(ctx, 'Home', 1), settle: true, verify: selected },
  { name: 'End', run: (ctx) => press(ctx, 'End', 1), settle: true, verify: selected },
];

const scenarios: Scenario[] = [
  {
    id: 'tabs/200',
    fixture: 'tabs/200',
    steps: [
      { name: 'switch tab', run: (ctx) => ctx.lib.set('value', 'item-150'), settle: true, verify: selected },
      {
        name: 'arrow x50',
        run: async (ctx) => {
          qa('[role="tab"]')[150].focus();
          await press(ctx, 'ArrowRight', 50);
        },
        settle: true,
        verify: selected,
      },
      ...arrowSteps('ArrowRight').filter((step) => step.name !== 'ArrowRight x50'),
    ],
  },
  { id: 'tabs/200-keepmounted', fixture: 'tabs/200-keepmounted', steps: arrowSteps('ArrowRight') },
  { id: 'tabs/200-vertical', fixture: 'tabs/200-vertical', steps: arrowSteps('ArrowDown') },
];

export default scenarios;
