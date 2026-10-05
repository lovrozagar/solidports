import { nextPaint } from './drivers';
import type { Lib, Scenario, Step, StepContext } from './types';
import { scenarios } from './scenarios';

export interface StepResult {
  sync: number;
  paint: number;
  /** JSON summary from the step's `verify` (compared across libraries by the runner). */
  summary: string | null;
  error: string | null;
}

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
    list: () =>
      scenarios.map((scenario) => ({
        id: scenario.id,
        steps: allSteps(scenario).map((step) => step.name),
      })),
    async step(id: string, index: number): Promise<StepResult> {
      const scenario = byId.get(id);
      if (!scenario) {
        throw new Error(`Unknown scenario ${id}`);
      }
      const step = allSteps(scenario)[index];
      let error: string | null = null;
      const start = performance.now();
      try {
        await step.run(ctx);
        lib.flush();
      } catch (caught) {
        error = String((caught as Error)?.stack ?? caught).slice(0, 400);
      }
      const sync = performance.now() - start;
      await nextPaint();
      const paint = performance.now() - start;
      if (step.settle) {
        await nextPaint();
        await nextPaint();
      }
      let summary: string | null = null;
      if (!error && step.verify) {
        try {
          summary = JSON.stringify(step.verify(ctx));
        } catch (caught) {
          error = `verify: ${String((caught as Error)?.message ?? caught).slice(0, 300)}`;
        }
      }
      return { sync, paint, summary, error };
    },
  };
}
