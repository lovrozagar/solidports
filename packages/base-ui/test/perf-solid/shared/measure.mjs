// CDP `ScriptDuration` leaves out script run inside a DevTools `Runtime.evaluate`, which is how
// `page.evaluate` runs a function. A step whose work is synchronous (a Solid flush) then reads no
// script at all, while a library that defers its work to later tasks (React) reads all of it. The
// benches run each measured function in its own task instead, and check the metric at startup.

/**
 * Runs `fn(arg)` in the page in a task of its own (a zero timeout), outside the evaluate that
 * starts it, and resolves with its (awaited) result. `fn` is sent as source: no closures.
 */
export function evaluateInTask(page, fn, arg) {
  return page.evaluate(
    ([source, value]) =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            // eslint-disable-next-line no-new-func -- the bench's own function, sent as source
            Promise.resolve(new Function(`return (${source})`)()(value)).then(resolve, reject);
          } catch (error) {
            reject(error);
          }
        }, 0);
      }),
    [fn.toString(), arg],
  );
}

/** The `ScriptDuration` a 10 ms synchronous burn run through `evaluateInTask` reads, in ms. */
export async function calibrateScript(page, cdp) {
  const read = async () =>
    (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'ScriptDuration')
      ?.value ?? 0;
  const before = await read();
  await evaluateInTask(
    page,
    (ms) => {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        // Synchronous work.
      }
    },
    10,
  );
  return ((await read()) - before) * 1000;
}

/** Exits the bench when the `script` metric misses a known 10 ms burn: no number would hold. */
export async function assertScriptMetric(page, cdp) {
  const ms = await calibrateScript(page, cdp);
  if (ms < 9) {
    console.error(
      `bench: a 10 ms synchronous burn read ${ms.toFixed(2)} ms of CDP ScriptDuration; the script metric is not measuring step work, so the run stops.`,
    );
    process.exit(1);
  }
}
