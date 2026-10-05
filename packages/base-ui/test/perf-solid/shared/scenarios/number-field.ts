import { click, key, nextPaint, qa, setInputValue, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const input = () => qa<HTMLInputElement>('[data-testid="nf-input"]')[0];
const value = () => input().value;

const scenarios: Scenario[] = [
  {
    id: 'number-field/100',
    fixture: 'number-field/100',
    steps: [
      {
        name: 'increment x100',
        run: async (ctx) => {
          const button = qa('[data-testid="nf-increment"]')[0];
          for (let i = 0; i < 100; i += 1) {
            click(button);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: value,
      },
      {
        name: 'ArrowUp x100',
        run: async (ctx) => {
          input().focus();
          for (let i = 0; i < 100; i += 1) {
            key('ArrowUp');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: value,
      },
      {
        name: 'wheel x50',
        run: async (ctx) => {
          input().focus();
          for (let i = 0; i < 50; i += 1) {
            input().dispatchEvent(
              new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }),
            );
            ctx.lib.flush();
            // Wheel input arrives about once per frame; React commits continuous-priority updates
            // per frame, so faster synthetic events would read a stale value there.
            await nextPaint();
          }
        },
        verify: value,
      },
      {
        name: 'press-and-hold 1s',
        run: async () => {
          const button = qa('[data-testid="nf-increment"]')[1];
          const before = Number(qa<HTMLInputElement>('[data-testid="nf-input"]')[1].value);
          const init = {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
          };
          button.dispatchEvent(new PointerEvent('pointerdown', init));
          await new Promise((resolve) => setTimeout(resolve, 1000));
          document.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
          button.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
          (window as unknown as { __holdBefore: number }).__holdBefore = before;
        },
        // The repeat count depends on timer jitter; both libraries must have repeated.
        verify: () =>
          Number(qa<HTMLInputElement>('[data-testid="nf-input"]')[1].value) >
          (window as unknown as { __holdBefore: number }).__holdBefore + 2,
      },
      {
        name: 'type value + blur',
        run: (ctx) => {
          const target = qa<HTMLInputElement>('[data-testid="nf-input"]')[2];
          target.focus();
          setInputValue(target, '1234.5');
          ctx.lib.flush();
          target.blur();
        },
        settle: true,
        verify: () => qa<HTMLInputElement>('[data-testid="nf-input"]')[2].value,
      },
    ],
  },
];

export default scenarios;
