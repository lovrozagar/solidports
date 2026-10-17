// The benchmark's two cycles over a scenario's steps (step 0 mounts, the last step unmounts).
//
// A forced full collection leaves the engine in a state no app mounts in, and timing the mount
// right after one measured that state: an A/A of one build flagged four false regressions on
// Linux (D17). A timing cycle therefore collects, then mounts and unmounts untimed, and times the
// mount warmed. It collects once more after the timed mount, outside the steps' timing: on the Mac
// that A/A was clean in both rounds, while a cycle with no collection after the mount flagged one
// false verdict. The heap reading needs a collection right before the mount, so it gets cycles of
// its own.
//
// Each cycle takes the page's operations: `collect()` (a full collection), `readHeap()` (used JS
// heap in bytes) and `runStep(index)` (runs one step and resolves with its result).

/**
 * Collect, an untimed mount and unmount, the timed mount, collect, then the other steps timed.
 * Resolves with the timed steps' results.
 */
export async function timingCycle({ collect, runStep, stepCount }) {
  await collect();
  await runStep(0);
  await runStep(stepCount - 1);
  const results = [await runStep(0)];
  await collect();
  for (let index = 1; index < stepCount; index += 1) results.push(await runStep(index));
  return results;
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
