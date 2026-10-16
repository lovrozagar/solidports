import { nextPaint } from './drivers';
import type { Step, StepContext } from './types';

/** How long `until` may take after the step settles before the step fails. */
export const UNTIL_TIMEOUT_MS = 2000;

export interface StepResult {
  sync: number;
  paint: number;
  /** JSON summary from the step's `verify` (compared across libraries by the runner). */
  summary: string | null;
  error: string | null;
}

/**
 * Runs one step: times the action through `flush()` and the next paint, settles, waits (untimed)
 * for `until`, then verifies.
 */
export async function runStep(step: Step, ctx: StepContext): Promise<StepResult> {
  let error: string | null = null;
  const start = performance.now();
  try {
    await step.run(ctx);
    ctx.lib.flush();
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
  if (!error && step.until) {
    const deadline = performance.now() + UNTIL_TIMEOUT_MS;
    while (!step.until(ctx)) {
      if (performance.now() > deadline) {
        error = `until: did not hold within ${UNTIL_TIMEOUT_MS} ms`;
        break;
      }
      await nextPaint();
    }
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
}
