import { flushMicrotasks } from './flushMicrotasks';
import type { Clock } from './createClock';

/**
 * Flushes pending work, advances the clock, and flushes again so effects scheduled by the
 * advanced timers run before the next assertion.
 */
export async function advanceClock(clock: Clock, milliseconds: number) {
  await flushMicrotasks();
  await clock.tickAsync(milliseconds);
  await flushMicrotasks();
}
