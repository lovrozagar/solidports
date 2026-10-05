import { click, highlightedText, key, nextPaint, q, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const openMenus = () => qa('[role="menu"]').length;
const target = (index: number) => q(`[data-target="item-${index}"]`);

function contextMenuAt(element: Element) {
  const rect = element.getBoundingClientRect();
  const init: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 2,
    buttons: 2,
    clientX: rect.left + 4,
    clientY: rect.top + 4,
  };
  element.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'mouse' }));
  element.dispatchEvent(new MouseEvent('mousedown', init));
  element.dispatchEvent(new MouseEvent('contextmenu', init));
}

function touch(type: string, element: Element) {
  const rect = element.getBoundingClientRect();
  const point = new Touch({
    identifier: 1,
    target: element,
    clientX: rect.left + 4,
    clientY: rect.top + 4,
  });
  element.dispatchEvent(
    new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      touches: type === 'touchend' ? [] : [point],
      targetTouches: type === 'touchend' ? [] : [point],
      changedTouches: [point],
    }),
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const scenarios: Scenario[] = [
  {
    id: 'context-menu/200',
    fixture: 'context-menu/200',
    steps: [
      {
        name: 'right-click open',
        run: () => contextMenuAt(target(100)),
        settle: true,
        verify: () => ({ menus: openMenus(), items: qa('[role="menuitem"]').length }),
      },
      {
        name: 'nav x20',
        run: async (ctx) => {
          for (let i = 0; i < 20; i += 1) {
            key('ArrowDown');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => highlightedText(),
      },
      {
        name: 'select item',
        run: () => click(q('[role="menuitem"][data-highlighted]')),
        settle: true,
        verify: () => ({ menus: openMenus() }),
      },
      {
        name: 'reopen + escape',
        run: async (ctx) => {
          contextMenuAt(target(150));
          ctx.lib.flush();
          await nextPaint();
          key('Escape');
          ctx.lib.flush();
        },
        settle: true,
        verify: () => ({ menus: openMenus() }),
      },
      {
        name: 'long-press open',
        run: async (ctx) => {
          touch('touchstart', target(50));
          ctx.lib.flush();
          await wait(650);
          touch('touchend', target(50));
          ctx.lib.flush();
        },
        settle: true,
        verify: () => ({ menus: openMenus() }),
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
];

export default scenarios;
