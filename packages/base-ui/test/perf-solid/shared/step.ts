import { nextPaint } from './drivers';
import type { Step, StepContext } from './types';

/** How long `until` may take after the step settles before the step fails. */
export const UNTIL_TIMEOUT_MS = 2000;

export interface StepResult {
  sync: number;
  paint: number;
  /**
   * For a step with `until`: ms from step start until `until` first held, timed at the mutation
   * batch that made it hold (or at a frame, when no mutation reports it). `null` otherwise.
   */
  settled: number | null;
  /** JSON summary from the step's `verify` (compared across libraries by the runner). */
  summary: string | null;
  error: string | null;
}

/**
 * Runs one step: times the action through `flush()` and the next paint, settles, waits (untimed)
 * for `until`, then verifies. A step with `until` gets a MutationObserver attached before the action,
 * so a close that lands early is still timed; steps without one pay nothing.
 */
export async function runStep(step: Step, ctx: StepContext): Promise<StepResult> {
  let error: string | null = null;
  let settledAt: number | null = null;
  let observer: MutationObserver | null = null;
  const until = step.until;
  if (until) {
    if (until(ctx)) {
      error = 'until: held before the step ran, so it measures nothing';
    } else {
      observer = new MutationObserver(() => {
        if (settledAt === null && until(ctx)) {
          settledAt = performance.now();
        }
      });
      observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    }
  }
  const start = performance.now();
  if (!error) {
    try {
      await step.run(ctx);
      ctx.lib.flush();
    } catch (caught) {
      error = String((caught as Error)?.stack ?? caught).slice(0, 400);
    }
  }
  const sync = performance.now() - start;
  await nextPaint();
  const paint = performance.now() - start;
  if (step.settle) {
    await nextPaint();
    await nextPaint();
  }
  if (!error && until) {
    // The frame loop is the fallback for an `until` on state no mutation reports.
    const deadline = performance.now() + UNTIL_TIMEOUT_MS;
    while (settledAt === null) {
      if (until(ctx)) {
        settledAt = performance.now();
      } else if (performance.now() > deadline) {
        error = `until: did not hold within ${UNTIL_TIMEOUT_MS} ms`;
        break;
      } else {
        await nextPaint();
      }
    }
  }
  observer?.disconnect();
  let summary: string | null = null;
  if (!error && step.verify) {
    try {
      summary = JSON.stringify(step.verify(ctx));
    } catch (caught) {
      error = `verify: ${String((caught as Error)?.message ?? caught).slice(0, 300)}`;
    }
  }
  const settled = settledAt === null || error ? null : settledAt - start;
  return { sync, paint, settled, summary, error };
}
