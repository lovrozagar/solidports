// Diagnostics of one bench step inside the bench's own cycle (off by default): `TRACE_STEP` traces
// it and `PROFILE_STEP` CPU-profiles it, each `<scenario> › <step>`, on every timed run of every
// variant, in the same page, order and collections as its timing (`shared/cycles.mjs`). A probe that
// reruns a step outside the bench approximates its state; this is the bench. Summaries per variant
// go to `DIAG_FILE` (default `/tmp/step-diag.json`). Chromium only (CDP).

/** Trace events summed per step, by name. */
const TRACE_NAMES = [
  'FunctionCall',
  'v8.callFunction',
  'RecalculateStyles',
  'UpdateLayoutTree',
  'Layout',
  'HitTest',
  'Paint',
  'PrePaint',
  'Layerize',
  'MajorGC',
  'MinorGC',
  'V8.GCScavenger',
  'V8.GCFinalizeMC',
  'V8.GCIncrementalMarking',
  'V8.GC_MC_BACKGROUND_MARKING',
  'BlinkGC.AtomicPhase',
];
const CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'blink',
  'v8',
  'v8.execute',
  'disabled-by-default-v8.gc',
];

export function diagFromEnv(env) {
  const trace = env.TRACE_STEP;
  const profile = env.PROFILE_STEP;
  if (!trace && !profile) {
    return undefined;
  }
  return { trace, profile, file: env.DIAG_FILE ?? '/tmp/step-diag.json', results: {} };
}

/** Runs `step` under the trace or profile `diag` names for `key` (`scenario › step`), if any. */
export async function withDiag(diag, cdp, variant, key, step) {
  if (!diag || !cdp || (key !== diag.trace && key !== diag.profile)) {
    return step();
  }
  diag.results[variant] ??= { runs: 0, trace: {}, traceCount: {}, self: {} };
  const entry = diag.results[variant];
  entry.runs += 1;
  if (key === diag.trace) {
    const events = [];
    const onData = ({ value }) => events.push(...value);
    cdp.on('Tracing.dataCollected', onData);
    await cdp.send('Tracing.start', {
      traceConfig: { includedCategories: CATEGORIES },
      transferMode: 'ReportEvents',
    });
    const result = await step();
    const complete = new Promise((resolve) => {
      cdp.once('Tracing.tracingComplete', resolve);
    });
    await cdp.send('Tracing.end');
    await complete;
    cdp.off('Tracing.dataCollected', onData);
    const open = new Map();
    for (const event of events) {
      if (!TRACE_NAMES.includes(event.name)) {
        continue;
      }
      let dur;
      if (event.ph === 'X') {
        dur = (event.dur ?? 0) / 1000;
      } else if (event.ph === 'B') {
        open.set(`${event.tid}:${event.name}`, event.ts);
      } else if (event.ph === 'E' && open.has(`${event.tid}:${event.name}`)) {
        dur = (event.ts - open.get(`${event.tid}:${event.name}`)) / 1000;
        open.delete(`${event.tid}:${event.name}`);
      }
      if (dur !== undefined) {
        entry.trace[event.name] = (entry.trace[event.name] ?? 0) + dur;
        entry.traceCount[event.name] = (entry.traceCount[event.name] ?? 0) + 1;
      }
    }
    return result;
  }
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 25 });
  await cdp.send('Profiler.start');
  const result = await step();
  const { profile } = await cdp.send('Profiler.stop');
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  profile.samples.forEach((id, index) => {
    const frame = byId.get(id).callFrame;
    const name = `${frame.functionName || '(anon)'} ${frame.url.split('/').pop()}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`;
    entry.self[name] = (entry.self[name] ?? 0) + (profile.timeDeltas[index] ?? 0) / 1000;
  });
  return result;
}

/** Per variant, per run averages, written to the diag file. */
export function writeDiag(diag, fs) {
  if (!diag) {
    return;
  }
  const out = {};
  for (const [variant, entry] of Object.entries(diag.results)) {
    const per = (record) =>
      Object.fromEntries(
        Object.entries(record)
          .map(([name, value]) => [name, Number((value / entry.runs).toFixed(3))])
          .sort((a, b) => b[1] - a[1]),
      );
    out[variant] = {
      runs: entry.runs,
      trace: per(entry.trace),
      traceCount: per(entry.traceCount),
      self: Object.fromEntries(Object.entries(per(entry.self)).slice(0, 60)),
    };
  }
  fs.writeFileSync(diag.file, JSON.stringify({ trace: diag.trace, profile: diag.profile, variants: out }, null, 2));
}
