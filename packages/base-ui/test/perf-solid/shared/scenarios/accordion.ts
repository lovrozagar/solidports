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
    ] as const
  ).map(
    ([id, tags]): Scenario => ({
      id,
      fixture: id,
      components: ['accordion'],
      tags: [...tags, 'open', 'close', 'toggle-all'],
      steps: [
        { name: 'open all', run: (ctx) => ctx.lib.set('value', all()), settle: true, verify: expanded },
        { name: 'close all', run: (ctx) => ctx.lib.set('value', []), settle: true, verify: expanded },
      ],
    }),
  ),
];

export default scenarios;
