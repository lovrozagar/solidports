// The order variants run in, for `run.mjs` (per round) and `ssr/sample.mjs` (per run). A fixed
// order puts each variant in the same place every time, and the place costs: the Mac's csbnoise
// (2026-10-20) judged identical code regressed by up to 0.18 ms from its place alone. A balanced
// (Williams) design gives every variant every place equally often and has it follow every other
// variant equally often, so a place's cost and the previous variant's carryover land on all alike.

/**
 * The orders of one balanced design over `names`, the given order first: `n` orders for an even
 * count, `2n` for an odd one (the `n` and their reverses). Two variants alternate AB, BA.
 * @template T
 * @param {readonly T[]} names
 * @returns {T[][]}
 */
export function balancedOrders(names) {
  const n = names.length;
  if (n < 2) {
    return [[...names]];
  }
  // 0, 1, n-1, 2, n-2, …: each difference between neighbors mod n occurs once.
  const first = [0];
  for (let low = 1, high = n - 1; first.length < n; ) {
    first.push(low);
    low += 1;
    if (first.length < n) {
      first.push(high);
      high -= 1;
    }
  }
  // Relabeled through the first row's inverse, which keeps the balance, so the first order is
  // the given one.
  const label = [];
  first.forEach((index, place) => {
    label[index] = names[place];
  });
  const rows = first.map((_, shift) => first.map((index) => label[(index + shift) % n]));
  return n % 2 === 0 ? rows : [...rows, ...rows.map((row) => [...row].reverse())];
}

/**
 * `runs` per variant at two rounds, spread over `rounds` rounds: the same total, so every variant
 * keeps its sample count, with rounds differing by at most one run.
 * @param {number} runs
 * @param {number} rounds
 * @returns {number[]}
 */
export function splitRuns(runs, rounds) {
  const total = 2 * runs;
  return Array.from(
    { length: rounds },
    (_, round) => Math.floor(total / rounds) + (round < total % rounds ? 1 : 0),
  );
}
