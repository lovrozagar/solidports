import { click, key, qa, stateOf, yieldTask } from '../drivers';
import type { Scenario } from '../types';

const checked = () =>
  qa('[role="checkbox"]').filter((el) => el.getAttribute('aria-checked') === 'true').length;
const parentState = () => ({
  parent: qa('[data-testid="parent"]')[0]?.getAttribute('aria-checked') ?? null,
  checked: checked(),
});

const scenarios: Scenario[] = [
  { id: 'checkbox/raw-1000', fixture: 'checkbox/raw', steps: [] },
  {
    id: 'checkbox/uncontrolled-1000',
    fixture: 'checkbox/uncontrolled',
    steps: [
      { name: 'click 1', run: () => click(qa('[role="checkbox"]')[500]), verify: () => checked() },
      {
        name: 'click 100',
        run: () => {
          const boxes = qa('[role="checkbox"]');
          for (let i = 0; i < 100; i += 1) click(boxes[i * 10]);
        },
        verify: () => checked(),
      },
      {
        name: 'space x50',
        run: async (ctx) => {
          const boxes = qa('[role="checkbox"]');
          for (let i = 0; i < 50; i += 1) {
            boxes[i * 20 + 1].focus();
            key(' ');
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: () => checked(),
      },
    ],
  },
  {
    id: 'checkbox/controlled-1000',
    fixture: 'checkbox/controlled',
    steps: [
      { name: 'toggle all', run: (ctx) => ctx.lib.set('checked', true), verify: () => checked() },
      { name: 'toggle all back', run: (ctx) => ctx.lib.set('checked', false), verify: () => checked() },
      { name: 'state of one', run: () => {}, verify: () => stateOf(qa('[role="checkbox"]')[0]) },
    ],
  },
  {
    id: 'checkbox/group-500-parent',
    fixture: 'checkbox/group-500-parent',
    steps: [
      {
        name: 'parent all/none x10',
        run: async (ctx) => {
          const parent = qa('[data-testid="parent"]')[0];
          for (let i = 0; i < 10; i += 1) {
            click(parent);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        verify: parentState,
      },
      {
        name: 'click child (indeterminate)',
        run: () => click(qa('[role="checkbox"]')[250]),
        verify: parentState,
      },
      { name: 'parent select all', run: () => click(qa('[data-testid="parent"]')[0]), verify: parentState },
    ],
  },
];

export default scenarios;
