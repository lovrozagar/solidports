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
  /** Steps after mount; `mount` and `unmount` are timed automatically. */
  steps: Step[];
  /** Verifies the mounted DOM (node count is always compared). */
  verifyMount?(ctx: StepContext): unknown;
}
