import { click, key, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const expanded = () => qa('[aria-expanded="true"]').length;
const all = () => Array.from({ length: qa('[aria-expanded]').length }, (_, i) => `item-${i}`);

const scenarios: Scenario[] = [
  {
    id: 'accordion/300',
    fixture: 'accordion/300',
    components: ['accordion'],
    tags: ['scale-100', 'controlled', 'reactive-props', 'open', 'close', 'toggle-all', 'keyboard'],
    steps: [
      {
        name: 'open one',
        run: (ctx) => ctx.lib.set('value', ['item-150']),
        settle: true,
        verify: expanded,
      },
      {
        name: 'open all',
        run: (ctx) => ctx.lib.set('value', all()),
        settle: true,
        verify: expanded,
      },
      { name: 'close all', run: (ctx) => ctx.lib.set('value', []), settle: true, verify: expanded },
      {
        name: 'ArrowDown x50',
        run: async (ctx) => {
          qa('[aria-expanded]')[0].focus();
          for (let i = 0; i < 50; i += 1) {
            key('ArrowDown');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => document.activeElement?.textContent ?? null,
      },
    ],
  },
  {
    id: 'accordion/300-animated',
    fixture: 'accordion/300-animated',
    components: ['accordion'],
    tags: ['scale-100', 'uncontrolled', 'pointer', 'open', 'close', 'animated'],
    steps: [
      {
        name: 'toggle x20',
        run: async (ctx) => {
          const trigger = qa('[aria-expanded]')[0];
          for (let i = 0; i < 20; i += 1) {
            click(trigger);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: expanded,
      },
    ],
  },
  // The motion branch (D19): every panel has a height transition, so each opening panel holds
  // `data-starting-style` for a frame and each closing one its ending style until the transition
  // ends. Both steps wait for the transitions, which run on the engine's clock.
  {
    id: 'accordion/motion-300',
    fixture: 'accordion/motion-300',
    components: ['accordion'],
    tags: ['scale-100', 'controlled', 'animated', 'open', 'close', 'toggle-all'],
    steps: [
      {
        name: 'open all',
        run: (ctx) => ctx.lib.set('value', all()),
        settle: true,
        // Opened panels sit at height 0 under the starting style before their transition starts,
        // and hold their measured size until it ends, then release it to `auto`.
        until: () =>
          expanded() === qa('[aria-expanded]').length &&
          qa('[data-starting-style]').length === 0 &&
          document.getAnimations().length === 0 &&
          qa('[role="region"]').every(
            (panel) => panel.style.getPropertyValue('--accordion-panel-height') === 'auto',
          ),
        timerMs: 200,
        verify: expanded,
      },
      {
        name: 'close all',
        run: (ctx) => ctx.lib.set('value', []),
        settle: true,
        until: () => qa('[role="region"]').length === 0,
        timerMs: 200,
        verify: expanded,
      },
    ],
  },
  // The coverage matrix's remaining axes (plan 3, leaf 1.13).
  {
    id: 'accordion/1',
    fixture: 'accordion/1',
    components: ['accordion'],
    tags: ['scale-1', 'uncontrolled', 'static-props', 'pointer', 'open', 'close'],
    steps: [
      {
        name: 'click open',
        run: () => click(qa('[aria-expanded]')[0]),
        settle: true,
        verify: expanded,
      },
      {
        name: 'click close',
        run: () => click(qa('[aria-expanded]')[0]),
        settle: true,
        verify: expanded,
      },
    ],
  },
  ...(
    [
      ['accordion/1000', ['scale-1000', 'controlled', 'reactive-props']],
      ['accordion/wrapper-300', ['scale-100', 'controlled', 'wrapper']],
      ['accordion/render-fn-300', ['scale-100', 'controlled', 'render-fn']],
      ['accordion/render-element-300', ['scale-100', 'controlled', 'render-element']],
      ['accordion/render-component-300', ['scale-100', 'controlled', 'render-component']],
      ['accordion/render-forward-300', ['scale-100', 'controlled', 'wrapper', 'render-fn']],
    ] as const
  ).map(([id, tags]): Scenario => ({
    id,
    fixture: id,
    components: ['accordion'],
    tags: [...tags, 'open', 'close', 'toggle-all'],
    steps: [
      {
        name: 'open all',
        run: (ctx) => ctx.lib.set('value', all()),
        settle: true,
        verify: expanded,
      },
      { name: 'close all', run: (ctx) => ctx.lib.set('value', []), settle: true, verify: expanded },
    ],
  })),
];

export default scenarios;
