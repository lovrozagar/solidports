import { click, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const expanded = () => qa('[aria-expanded="true"]').length;

const scenarios: Scenario[] = [
  {
    id: 'collapsible/300',
    fixture: 'collapsible/300',
    components: ['collapsible'],
    tags: ['scale-100', 'controlled', 'reactive-props', 'open', 'close', 'toggle-all'],
    steps: [
      { name: 'open all', run: (ctx) => ctx.lib.set('open', true), settle: true, verify: expanded },
      {
        name: 'close all',
        run: (ctx) => ctx.lib.set('open', false),
        settle: true,
        verify: expanded,
      },
    ],
  },
  {
    id: 'collapsible/300-uncontrolled',
    fixture: 'collapsible/300-uncontrolled',
    components: ['collapsible'],
    tags: ['scale-100', 'uncontrolled', 'pointer', 'open', 'close'],
    steps: [
      {
        name: 'click 1',
        run: () => click(qa('[aria-expanded]')[150]),
        settle: true,
        verify: expanded,
      },
      {
        name: 'click 100',
        run: async (ctx) => {
          const triggers = qa('[aria-expanded]');
          for (let i = 0; i < 100; i += 1) {
            click(triggers[i * 3]);
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
    id: 'collapsible/1',
    fixture: 'collapsible/1',
    components: ['collapsible'],
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
      ['collapsible/1000', ['scale-1000', 'controlled', 'reactive-props']],
      ['collapsible/wrapper-300', ['scale-100', 'controlled', 'wrapper']],
      ['collapsible/render-fn-300', ['scale-100', 'controlled', 'render-fn']],
      ['collapsible/render-element-300', ['scale-100', 'controlled', 'render-element']],
      ['collapsible/render-component-300', ['scale-100', 'controlled', 'render-component']],
    ] as const
  ).map(
    ([id, tags]): Scenario => ({
      id,
      fixture: id,
      components: ['collapsible'],
      tags: [...tags, 'open', 'close', 'toggle-all'],
      steps: [
        { name: 'open all', run: (ctx) => ctx.lib.set('open', true), settle: true, verify: expanded },
        { name: 'close all', run: (ctx) => ctx.lib.set('open', false), settle: true, verify: expanded },
      ],
    }),
  ),
];

export default scenarios;
