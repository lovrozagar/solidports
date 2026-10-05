import { click, key, q, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const focused = () => ({
  tag: document.activeElement?.tagName ?? null,
  text: document.activeElement?.textContent ?? null,
  menu: !!document.querySelector('[role="menu"]'),
});

const scenarios: Scenario[] = [
  {
    id: 'toolbar/200',
    fixture: 'toolbar/200',
    steps: [
      {
        name: 'ArrowRight x100',
        run: async (ctx) => {
          qa('[data-testid="tb-button"]')[0].focus();
          for (let i = 0; i < 100; i += 1) {
            key('ArrowRight');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: focused,
      },
      { name: 'focus input', run: () => click(q('[data-testid="tb-input"]')), verify: focused },
      {
        name: 'open menu via toolbar button',
        run: () => click(q('[data-testid="tb-menu"]')),
        settle: true,
        verify: focused,
      },
      { name: 'close menu', run: () => key('Escape'), settle: true, verify: () => !!document.querySelector('[role="menu"]') },
    ],
  },
];

export default scenarios;
