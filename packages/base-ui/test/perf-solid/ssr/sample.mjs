// Server render sampling for `ssr/run.mjs`. A single render per sample cannot judge a server
// change: a collection pause or a stall (50–60 ms on the Mac's progress/1000) lands on about one
// render in ten, and with 10 samples p90 is the maximum, so one such sample on either side made a
// 2x change read "same" under the 1.6 rule. A sample is therefore the mean of a batch of renders
// sized to `batchMs`, the heap is collected before each batch (outside the timed span), and 20
// samples keep p90 off the maximum. Variants are interleaved per run so drift lands on all alike,
// in a balanced order that changes run by run (`shared/order.mjs`), so their place in it does too.

import { balancedOrders } from '../shared/order.mjs';

/** The sampling `bench:component` and `ssr/run.mjs` use. */
export const SERVER_SAMPLING = { runs: 20, warmup: 5, batchMs: 250 };

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * Server ms samples per variant, each the mean render time of one batch. The warmup renders,
 * timed singly, size the batch: the same count for every variant, so each sample covers the
 * same work.
 * @param {Record<string, () => unknown>} renders the case's render per variant
 * @param {{ runs: number, warmup: number, batchMs: number, gc: () => void, now?: () => number }} options
 * @returns {{ samples: Record<string, number[]>, batch: number }}
 */
export function sampleServer(
  renders,
  { runs, warmup, batchMs, gc, now = () => performance.now() },
) {
  if (typeof gc !== 'function') {
    throw new Error('sampleServer: pass gc (run node with --expose-gc and pass globalThis.gc)');
  }
  const names = Object.keys(renders);
  const orders = balancedOrders(names);
  const warm = [];
  for (let run = 0; run < Math.max(1, warmup); run += 1) {
    for (const name of orders[run % orders.length]) {
      gc();
      const start = now();
      renders[name]();
      warm.push(now() - start);
    }
  }
  const batch = Math.max(1, Math.ceil(batchMs / Math.max(median(warm), 0.001)));
  const samples = Object.fromEntries(names.map((name) => [name, []]));
  for (let run = 0; run < runs; run += 1) {
    for (const name of orders[run % orders.length]) {
      gc();
      const start = now();
      for (let i = 0; i < batch; i += 1) {
        renders[name]();
      }
      samples[name].push((now() - start) / batch);
    }
  }
  return { samples, batch };
}
