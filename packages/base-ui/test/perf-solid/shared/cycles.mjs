// The benchmark's two cycles over a scenario's steps (step 0 mounts, the last step unmounts).
//
// A forced full collection leaves the engine in a state no app mounts in, and timing the mount
// right after one measured that state: an A/A of one build flagged four false regressions on
// Linux (D17). A timing cycle therefore collects, then mounts and unmounts untimed, and times the
// mount warmed. Every later timed step starts after a collection of its own, outside its timing:
// steps run back to back, so without one a step paid for the garbage the steps before it left,
// which hid a real 1.5 ms regression on checkbox/controlled-1000 and moved cost between steps
// whenever a change moved allocation (perf/method.md). The garbage a step leaves is measured
// instead, as what it retains: the collected heap after it minus the collected heap before it
// (`retainedKB`; its growth with the garbage included depends on when the engine scavenged, which
// moved 1.6 MB between steps of an unchanged-retention build, perf/method.md). The heap reading
// needs a collection right before the mount, so it gets cycles of its own.
//
// Each cycle takes the page's operations: `collect()` (a full collection), `readHeap()` (used JS
// heap in bytes) and `runStep(index)` (runs one step and resolves with its result).

/**
 * Collect, an untimed mount and unmount, the timed mount, then each other step timed after a
 * collection of its own. Resolves with the timed steps' results; given `readFinalHeap`, it collects
 * once more after the last step and sets the results' `finalHeap`, for the last step's retention.
 */
export async function timingCycle({ collect, runStep, stepCount, readFinalHeap }) {
  await collect();
  await runStep(0);
  await runStep(stepCount - 1);
  const results = [await runStep(0)];
  for (let index = 1; index < stepCount; index += 1) {
    await collect();
    results.push(await runStep(index));
  }
  if (readFinalHeap) {
    await collect();
    results.finalHeap = await readFinalHeap();
  }
  return results;
}

/**
 * What each step retains, in KB: the collected heap before the next step (or `finalHeap`, after the
 * last) minus the collected heap before it. `heaps[i]` is the heap read before step `i`, after its
 * collection; the mount's (step 0) follows the untimed warm-up instead, so it gets `null` (the heap
 * cycle judges the mount).
 */
export function retainedKB(heaps, finalHeap) {
  return heaps.map((heap, index) => {
    if (index === 0) {
      return null;
    }
    const next = index + 1 < heaps.length ? heaps[index + 1] : finalHeap;
    return (next - heap) / 1024;
  });
}

/** Collect, read, mount, collect, read, unmount. Resolves with the mounted tree's heap in KB. */
export async function heapCycle({ collect, readHeap, runStep, stepCount }) {
  await collect();
  const before = await readHeap();
  await runStep(0);
  await collect();
  const after = await readHeap();
  await runStep(stepCount - 1);
  return (after - before) / 1024;
}
