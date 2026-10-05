import { click, hover, key, nextPaint, q, qa } from '../drivers';
import type { Scenario } from '../types';

const summary = () => ({
  expanded: qa('[data-nav]')
    .filter((el) => el.getAttribute('aria-expanded') === 'true')
    .map((el) => el.getAttribute('data-nav')),
  links: qa('a[href^="#item-"]').length,
});

async function frames(count: number) {
  for (let i = 0; i < count; i += 1) await nextPaint();
}

const scenarios: Scenario[] = [
  {
    id: 'navigation-menu/8x100',
    fixture: 'navigation-menu/8x100',
    steps: [
      {
        name: 'hover open',
        run: async (ctx) => {
          hover(q('[data-nav="item-0"]'));
          ctx.lib.flush();
          await frames(2);
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'move across 8 triggers',
        run: async (ctx) => {
          for (const trigger of qa('[data-nav]')) {
            hover(trigger);
            ctx.lib.flush();
            await frames(2);
          }
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'escape',
        run: (ctx) => {
          key('Escape', q('[data-nav="item-7"]'));
          ctx.lib.flush();
        },
        settle: true,
        verify: summary,
      },
      {
        name: 'keyboard into content',
        run: async (ctx) => {
          const trigger = q('[data-nav="item-3"]');
          trigger.focus();
          click(trigger);
          ctx.lib.flush();
          await frames(2);
          key('ArrowDown', trigger);
          ctx.lib.flush();
        },
        settle: true,
        verify: () => ({
          ...summary(),
          focused: document.activeElement?.textContent?.trim() ?? null,
        }),
      },
      {
        name: 'link click',
        run: () => click(qa('a[href^="#item-3-"]')[10]),
        settle: true,
        verify: summary,
      },
    ],
  },
];

export default scenarios;
