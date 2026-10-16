import { click, key, qa, yieldTask } from '../drivers';
import type { Scenario, Step } from '../types';

const toggles = () => qa('button[aria-pressed]');
const pressed = () => ({
  count: toggles().filter((el) => el.getAttribute('aria-pressed') === 'true').length,
  first: toggles().find((el) => el.getAttribute('aria-pressed') === 'true')?.textContent ?? null,
  focused: document.activeElement?.textContent ?? null,
});

const clickSteps: Step[] = [
  { name: 'click 1', run: () => click(toggles()[150]), verify: pressed },
  {
    name: 'click 100',
    run: async (ctx) => {
      const all = toggles();
      for (let i = 0; i < 100; i += 1) {
        click(all[i * 2]);
        ctx.lib.flush();
        await yieldTask();
      }
    },
    verify: pressed,
  },
];

const groupSteps: Step[] = [
  ...clickSteps,
  {
    name: 'ArrowRight x50',
    run: async (ctx) => {
      toggles()[0].focus();
      for (let i = 0; i < 50; i += 1) {
        key('ArrowRight');
        ctx.lib.flush();
        await yieldTask();
      }
    },
    verify: pressed,
  },
  { name: 'controlled value', run: (ctx) => ctx.lib.set('value', ['item-5']), verify: pressed },
];

const scenarios: Scenario[] = [
  {
    id: 'toggle/raw-1000',
    fixture: 'toggle/raw',
    components: ['toggle'],
    tags: ['scale-1000', 'static-props', 'raw'],
    steps: [],
  },
  {
    id: 'toggle-group/raw-300',
    fixture: 'toggle-group/raw',
    components: ['toggle-group', 'toggle'],
    tags: ['scale-100', 'static-props', 'raw'],
    steps: [],
  },
  {
    id: 'toggle/1000',
    fixture: 'toggle/1000',
    components: ['toggle'],
    tags: ['scale-1000', 'uncontrolled', 'pointer'],
    steps: clickSteps,
  },
  {
    id: 'toggle-group/300-single',
    fixture: 'toggle-group/300-single',
    components: ['toggle-group', 'toggle'],
    tags: ['scale-100', 'controlled', 'reactive-props', 'pointer', 'keyboard'],
    steps: groupSteps,
  },
  {
    id: 'toggle-group/300-multiple',
    fixture: 'toggle-group/300-multiple',
    components: ['toggle-group', 'toggle'],
    tags: ['scale-100', 'controlled', 'reactive-props', 'pointer', 'keyboard'],
    steps: groupSteps,
  },
];

export default scenarios;
