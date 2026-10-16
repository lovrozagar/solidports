import { drag, key, q, qa, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const values = () =>
  qa('[data-testid="range"] input[type="range"]').map((input) =>
    input.getAttribute('aria-valuenow'),
  );

const scenarios: Scenario[] = [
  {
    id: 'slider/controlled',
    fixture: 'slider/controlled',
    components: ['slider'],
    tags: ['scale-1', 'controlled', 'reactive-props'],
    steps: [
      {
        name: '300 updates',
        run: (ctx) => {
          for (let i = 1; i <= 300; i += 1) ctx.lib.set('value', i);
        },
        verify: () => q('input[type="range"]').getAttribute('aria-valuenow'),
      },
    ],
  },
  {
    id: 'slider/range',
    fixture: 'slider/range',
    components: ['slider'],
    tags: ['scale-1', 'uncontrolled', 'pointer', 'keyboard'],
    steps: [
      {
        name: 'track drag 300 moves',
        run: (ctx) => drag(q('[data-testid="range-control"]'), 120, 0, 300, ctx.lib.flush),
        settle: true,
        verify: values,
      },
      {
        name: 'thumb drag 100 moves',
        run: (ctx) => drag(qa('[data-testid="range-thumb"]')[0], -100, 0, 100, ctx.lib.flush),
        settle: true,
        verify: values,
      },
      {
        name: 'ArrowRight x100',
        run: async (ctx) => {
          qa<HTMLInputElement>('[data-testid="range"] input[type="range"]')[0].focus();
          for (let i = 0; i < 100; i += 1) {
            key('ArrowRight');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: values,
      },
      {
        name: 'PageUp x10',
        run: async (ctx) => {
          for (let i = 0; i < 10; i += 1) {
            key('PageUp');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: values,
      },
    ],
  },
  {
    id: 'slider/100',
    fixture: 'slider/100',
    components: ['slider'],
    tags: ['scale-100', 'static-props'],
    steps: [],
  },
];

export default scenarios;
