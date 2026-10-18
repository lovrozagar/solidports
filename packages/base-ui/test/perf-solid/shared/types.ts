import type { ComponentName, ScenarioTag } from './manifest';

/** What each app (React or Solid) exposes to the shared scenarios. */
export interface Lib {
  name: 'react' | 'solid';
  /** Renders fixture `key` into the page root and flushes. */
  mount(key: string): void;
  unmount(): void;
  /** Sets a fixture's exposed controlled state (`useExposed(key)`) and flushes synchronously. */
  set(key: string, value: unknown): void;
  /** Applies pending updates synchronously (Solid `flush()`; React already flushed). */
  flush(): void;
}

export interface StepContext {
  lib: Lib;
  root: HTMLElement;
}

export interface Step {
  name: string;
  /** The timed action. Async steps may await between events (`yieldTask`), as user input does. */
  run(ctx: StepContext): void | Promise<void>;
  /** Waits three frames after the step (positioning, animations-finished checks). */
  settle?: boolean;
  /**
   * An input the engine must provide: where it is missing (Firefox's desktop build has no `Touch`)
   * the step is skipped and reports no sample, as an engine's unmeasured columns do.
   */
  requires?: 'touch';
  /**
   * Waits after settling, untimed, until this holds; the step fails if it does not within
   * `UNTIL_TIMEOUT_MS`. For end states a library reaches on its own timer (a hover close on
   * safePolygon's 40 ms timeout), which a fixed frame count races.
   */
  until?(ctx: StepContext): boolean;
  /**
   * The library's own wait before `until` can hold (40 for safePolygon's close), required with
   * `until`. The report shows `settled - timerMs`, the render cost after the timer fires.
   */
  timerMs?: number;
  /**
   * The step is the scenario's first open of something a part builds on its first open instead of
   * at mount (a panel's transition machinery, a popup's unmount machinery): its heap growth is
   * judged together with the mount's heap, as one budget (`openBudgetKB`, the two-budget rule), so
   * memory moved from mount to the first open is not counted twice. Marked by hand, never
   * inferred from the step's name or position.
   */
  firstOpen?: boolean;
  /**
   * Reads the DOM after the step and returns a JSON-able summary. The runner fails the scenario
   * when the summaries differ between libraries; throw for a hard expectation.
   */
  verify?(ctx: StepContext): unknown;
}

export interface Scenario {
  /** Unique id, `<component>/<name>`. */
  id: string;
  /** The fixture key both apps register. */
  fixture: string;
  /** Components the scenario measures, primary first (`manifest.ts`). */
  components: readonly [ComponentName, ...ComponentName[]];
  /** Coverage dimensions the scenario exercises (`manifest.ts`). */
  tags: readonly ScenarioTag[];
  /** Steps after mount; `mount` and `unmount` are timed automatically. */
  steps: Step[];
  /** Verifies the mounted DOM (node count is always compared). */
  verifyMount?(ctx: StepContext): unknown;
}
