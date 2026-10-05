import { click, hover, key, nextPaint, q, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const expanded = () =>
  qa('[data-bar]')
    .filter((el) => el.getAttribute('aria-expanded') === 'true')
    .map((el) => el.getAttribute('data-bar'));
const summary = () => ({ expanded: expanded(), menus: qa('[role="menu"]').length });

const scenarios: Scenario[] = [
  {
    id: 'menubar/10x50',
    fixture: 'menubar/10x50',
    steps: [
      {
        name: 'open first',
        run: () => click(q('[data-bar="item-0"]')),
        settle: true,
        verify: summary,
      },
      {
        name: 'arrow right x9',
        run: async (ctx) => {
          for (let i = 0; i < 9; i += 1) {
            key('ArrowRight');
            ctx.lib.flush();
            await nextPaint();
          }
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'hover switch x10',
        run: async (ctx) => {
          for (const trigger of qa('[data-bar]')) {
            hover(trigger);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'escape',
        run: (ctx) => {
          key('Escape');
          ctx.lib.flush();
        },
        settle: true,
        verify: summary,
      },
    ],
  },
];

export default scenarios;
