import { key, qa, setInputValue, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const inputs = () => qa<HTMLInputElement>('[data-testid="otp"] input:not([type="hidden"])');
const summary = () => ({
  value: inputs()
    .map((input) => input.value || '_')
    .join(''),
  active: inputs().indexOf(document.activeElement as HTMLInputElement),
});

function steps(length: number): Scenario['steps'] {
  const code = '0123456789AB'.slice(0, length);
  return [
    {
      name: 'type all',
      run: async (ctx) => {
        inputs()[0].focus();
        for (const char of code) {
          const target = document.activeElement as HTMLInputElement;
          key(char, target);
          setInputValue(target, char);
          ctx.lib.flush();
          await yieldTask();
        }
      },
      verify: summary,
    },
    {
      name: 'backspace through',
      run: async (ctx) => {
        inputs()[length - 1].focus();
        for (let i = 0; i < length; i += 1) {
          key('Backspace');
          ctx.lib.flush();
          await yieldTask();
        }
      },
      verify: summary,
    },
    {
      name: 'paste code',
      run: (ctx) => {
        const first = inputs()[0];
        first.focus();
        const data = new DataTransfer();
        data.setData('text/plain', code);
        first.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
        );
        ctx.lib.flush();
      },
      settle: true,
      verify: summary,
    },
    {
      name: 'arrow left through',
      run: async (ctx) => {
        inputs()[length - 1].focus();
        for (let i = 0; i < length; i += 1) {
          key('ArrowLeft');
          ctx.lib.flush();
          await yieldTask();
        }
      },
      verify: summary,
    },
  ];
}

const scenarios: Scenario[] = [
  { id: 'otp-field/6', fixture: 'otp-field/6', steps: steps(6) },
  { id: 'otp-field/12', fixture: 'otp-field/12', steps: steps(12) },
];

export default scenarios;
