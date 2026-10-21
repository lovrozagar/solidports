/*
 * The frame timing the floors hand-write, in plain DOM (D31: a floor imports nothing from the
 * library). A copy of the part of `src/utils/useAnimationFrame` the floors use, so a floor keeps the
 * parts' timing on every branch (`startingTimeline.ts`):
 * - Every callback requested before a frame runs in one `requestAnimationFrame` tick, in request
 *   order: a request made after another script's own frame request still joins the earlier tick.
 * - Work queued from inside a tick runs in a single task after it, scheduled when the tick ends, so
 *   its writes flush once. Outside a tick the work gets a task of its own.
 * - A test that swaps `requestAnimationFrame` (fake timers) gets a new tick on its next request,
 *   so a tick the fake clock never ran does not hold the queue.
 */

let callbacks: Array<(() => void) | null> = [];
let pending = 0;
let nextId = 1;
let startId = 1;
let scheduled = false;
let scheduledWith: typeof requestAnimationFrame | undefined;
let afterFrame: Array<() => void> | undefined;

function tick() {
  scheduled = false;
  const current = callbacks;
  const count = pending;
  callbacks = [];
  pending = 0;
  startId = nextId;
  if (count === 0) {
    return;
  }
  const batch: Array<() => void> = [];
  const outer = afterFrame;
  afterFrame = batch;
  try {
    for (const callback of current) {
      callback?.();
    }
  } finally {
    afterFrame = outer;
    if (batch.length > 0) {
      setTimeout(() => {
        for (const queued of batch) {
          queued();
        }
      });
    }
  }
}

/** Runs `callback` in the next frame's shared tick; returns the id `cancelFrame` takes. */
export function requestFrame(callback: () => void) {
  const id = nextId;
  nextId += 1;
  callbacks.push(callback);
  pending += 1;
  if (!scheduled || scheduledWith !== requestAnimationFrame) {
    scheduledWith = requestAnimationFrame;
    requestAnimationFrame(tick);
    scheduled = true;
  }
  return id;
}

export function cancelFrame(id: number) {
  const index = id - startId;
  if (index < 0 || index >= callbacks.length || callbacks[index] === null) {
    return;
  }
  callbacks[index] = null;
  pending -= 1;
}

/** Queues `callback` for the task after the current tick (one task a tick), or a task of its own. */
export function queueAfterFrame(callback: () => void) {
  if (afterFrame) {
    afterFrame.push(callback);
  } else {
    setTimeout(callback);
  }
}
