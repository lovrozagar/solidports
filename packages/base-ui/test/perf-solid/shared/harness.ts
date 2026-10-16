import { COMPONENTS, SCENARIO_TAGS } from './manifest';
import { scenarios } from './scenarios';
import { runStep, type StepResult } from './step';
import type { Lib, Scenario, Step, StepContext } from './types';

function allSteps(scenario: Scenario): Step[] {
  return [
    {
      name: 'mount',
      run: (ctx) => ctx.lib.mount(scenario.fixture),
      settle: true,
      verify: (ctx) => ({
        nodes: document.body.querySelectorAll('*').length,
        custom: scenario.verifyMount?.(ctx) ?? null,
      }),
    },
    ...scenario.steps,
    {
      name: 'unmount',
      run: (ctx) => ctx.lib.unmount(),
      settle: true,
      verify: (ctx) => ({ rootChildren: ctx.root.childElementCount }),
    },
  ];
}

/** Exposes `window.bench` for the runner: the scenario list and one timed step at a time. */
export function installHarness(lib: Lib) {
  const root = document.getElementById('root')!;
  const ctx: StepContext = { lib, root };
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

  (window as unknown as { bench: unknown }).bench = {
    lib: lib.name,
    /** Debugging: mount / unmount / set a fixture directly. */
    debug: lib,
    /** The manifest vocabularies, so the runner validates its filter. */
    vocab: { components: COMPONENTS, tags: SCENARIO_TAGS },
    list: () =>
      scenarios.map((scenario) => ({
        id: scenario.id,
        components: scenario.components,
        tags: scenario.tags,
        steps: allSteps(scenario).map((step) => step.name),
      })),
    async step(id: string, index: number): Promise<StepResult> {
      const scenario = byId.get(id);
      if (!scenario) {
        throw new Error(`Unknown scenario ${id}`);
      }
      const step = allSteps(scenario)[index];
      return runStep(step, ctx);
    },
  };
}
