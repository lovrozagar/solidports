// TTI (D29): the time from navigation start to the first real click whose effect appears. The
// runner clicks the case's trigger once per frame from the first paint and checks the effect before
// the next click, so a click that lands is never undone by the one after it. React commits a
// discrete event's update within the click's task and Solid within its microtask flush, so the
// effect of a click that landed is visible one frame later. A trigger that never responds fails the
// case outright: a dead button after hydration is a broken page, not a slow sample (eab5146a's
// Safari hydration failure).

/** The failure of a trigger whose click never takes effect. */
export const DEAD_TRIGGER = 'trigger never became interactive';

/**
 * INP (D29), installed in the page before its scripts (`page.addInitScript`), so it must not read
 * the module's scope. Each interaction runs from its press (`pointerdown`, where popups often open)
 * to the first paint after its click: the next frame, then a task, as the browser paints in
 * between. Capture listeners on the window run before either library's delegated handlers. Event
 * Timing reports the same span rounded to 8 ms; this keeps `performance.now()`'s resolution. A click
 * with no press (a keyboard activation) runs from the click. Records land in `__interactions`.
 * @param {Window & { __interactions?: { start: number, latencyMs?: number }[] }} [win]
 */
export function recordInteractions(win = window) {
  win.__interactions = [];
  let pressed = null;
  win.addEventListener(
    'pointerdown',
    (event) => {
      pressed = { start: event.timeStamp };
    },
    true,
  );
  win.addEventListener(
    'click',
    (event) => {
      const record = pressed ?? { start: event.timeStamp };
      pressed = null;
      win.__interactions.push(record);
      win.requestAnimationFrame(() => {
        win.setTimeout(() => {
          record.latencyMs = win.performance.now() - record.start;
        }, 0);
      });
    },
    true,
  );
}

/**
 * The SSR runner's check mode (D29): `SSR_CHECK=chromium` or `SSR_CHECK=webkit` runs the
 * interactive cases in that browser for correctness only (`checkInteraction`), timing nothing.
 * test-all's benchmark suite and CI's benchmark job run it in Chromium.
 * @param {Record<string, string | undefined>} env
 * @returns {'chromium' | 'webkit' | null}
 */
export function checkMode(env) {
  if (env.SSR_CHECK === undefined || env.SSR_CHECK === '') {
    return null;
  }
  if (env.SSR_CHECK !== 'chromium' && env.SSR_CHECK !== 'webkit') {
    throw new Error(
      `SSR_CHECK=${env.SSR_CHECK}: the check runs in SSR_CHECK=chromium or SSR_CHECK=webkit`,
    );
  }
  return env.SSR_CHECK;
}

/**
 * The check run's output and exit code: a line per case and library it checked (`ok`, or `FAIL`
 * when one of the problems `run.mjs` prefixes with `<case> [<library>, <browser>]` is its), then
 * the counts. A run that checked nothing fails, so an empty filter or a case list without
 * interactions cannot pass as a clean check.
 * @param {{ key: string, name: string }[]} checked
 * @param {string} browser
 * @param {string[]} problems
 * @returns {{ lines: string[], code: 0 | 1 }}
 */
export function checkSummary(checked, browser, problems) {
  if (checked.length === 0) {
    return {
      lines: [
        'SSR check: 0 cases checked (no case matched with an interaction); nothing was checked',
      ],
      code: 1,
    };
  }
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const label = ({ key, name }) => `${key} [${name}, ${browser}]`;
  const cases = new Set(checked.map((c) => c.key)).size;
  const libraries = new Set(checked.map((c) => c.name)).size;
  return {
    lines: [
      ...checked.map(
        (c) => `${label(c)} ${problems.some((p) => p.startsWith(label(c))) ? 'FAIL' : 'ok'}`,
      ),
      `SSR check: ${plural(cases, 'case', 'cases')} × ${plural(libraries, 'library', 'libraries')}, ${plural(problems.length, 'problem', 'problems')}`,
    ],
    code: problems.length > 0 ? 1 : 0,
  };
}

/**
 * One interactive case's correctness check on one cold load (`measureInteraction`): its problems,
 * none when it passes. It fails on a dead trigger, a load that measured no TTI, a page error, or a
 * hydration warning in the console, and never on a timing.
 * @param {import('playwright').Browser} browser
 * @param {string} url
 * @param {{ trigger: string, effect: object, undo: unknown }} interaction
 * @param {{ measure?: typeof measureInteraction }} [options] `measure` stands in for the load in tests
 * @returns {Promise<string[]>}
 */
export async function checkInteraction(
  browser,
  url,
  interaction,
  { measure = measureInteraction } = {},
) {
  const problems = [];
  try {
    const { ttiMs, page } = await measure(browser, url, interaction, {
      cdp: false,
      onPage: (opened) => {
        opened.on('console', (message) => {
          if (/hydrat|mismatch|unclaimed/i.test(message.text())) {
            problems.push(message.text().slice(0, 200));
          }
        });
        opened.on('pageerror', (error) =>
          problems.push(`pageerror: ${String(error).slice(0, 200)}`),
        );
      },
    });
    if (!Number.isFinite(ttiMs)) {
      problems.push('no TTI measured');
    }
    await page.close();
  } catch (error) {
    problems.push(String(error?.message ?? error).slice(0, 200));
  }
  return problems;
}

/** How long a trigger may stay dead before the case fails. */
export const TTI_TIMEOUT_MS = 10_000;

/**
 * Installs `__perfEffectShows(effect)` in the page (an init script, so self-contained): whether the
 * case's effect shows. The trigger is the element first clicked (`__perfTrigger`).
 */
function installEffectCheck() {
  window.__perfEffectShows = (effect) => {
    const el = effect.selector ? document.querySelector(effect.selector) : window.__perfTrigger;
    if (effect.absent) {
      return el == null;
    }
    return el?.getAttribute(effect.attribute) === effect.value;
  };
}

/**
 * One cold page load of `url` in a new context, clicked as a user would from the first paint:
 * real mouse events (CDP `Input.dispatchMouseEvent`) at the trigger's center, once per frame,
 * until the case's effect shows. The trigger is resolved once, on the server's markup, so a
 * hydration that replaced it reads as a dead trigger.
 * @param {import('playwright').Browser} browser
 * @param {string} url the page, with `auto=1` so the client hydrates on load
 * @param {{ trigger: string, effect: object, undo: unknown }} interaction
 * @param {{ throttle?: number, timeoutMs?: number, cdp?: boolean, onPage?: (page: import('playwright').Page) => void }} [options]
 *   `cdp: false` (WebKit) clicks through Playwright's mouse and reads no CDP metrics; `onPage` sees
 *   the page before it loads
 * Then INP: the landing click's latency (`inpFirstMs`), the undo, and a warm second click's
 * (`inpMs`), each from its press to the next paint (`recordInteractions`).
 * @returns {Promise<{ ttiMs: number, clicks: number, inpFirstMs: number, inpMs: number, hydrateLoadCommitMs: number | null, scriptMs: number, bundleBytes: number, page: import('playwright').Page }>}
 *   the caller closes the page
 */
export async function measureInteraction(browser, url, interaction, options = {}) {
  const page = await browser.newPage();
  options.onPage?.(page);
  await page.addInitScript(recordInteractions);
  await page.addInitScript(installEffectCheck);
  const cdp = options.cdp === false ? null : await page.context().newCDPSession(page);
  await cdp?.send('Performance.enable');
  if (cdp && (options.throttle ?? 1) > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: options.throttle });
  }
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(
    (selector) => document.querySelector(selector) != null,
    interaction.trigger,
  );
  /** A real click at the center of the stashed trigger, or of `selector`'s first match. */
  const clickAt = async (selector) => {
    const [x, y] = await page.evaluate(
      ([trigger, other]) => {
        const el = other
          ? document.querySelector(other)
          : (window.__perfTrigger ??= document.querySelector(trigger));
        const rect = el.getBoundingClientRect();
        return [rect.x + rect.width / 2, rect.y + rect.height / 2];
      },
      [interaction.trigger, selector ?? null],
    );
    if (!cdp) {
      await page.mouse.click(x, y);
      return;
    }
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
  };
  const driver = {
    now: () => page.evaluate(() => performance.now()),
    click: () => clickAt(),
    nextFrame: () =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() => resolve());
          }),
      ),
    effectSeen: () =>
      page.evaluate((effect) => window.__perfEffectShows(effect), interaction.effect),
  };
  let landed;
  try {
    landed = await firstHandledClick(driver, { timeoutMs: options.timeoutMs ?? TTI_TIMEOUT_MS });
  } catch (error) {
    // The caller closes the page it gets back; a failed load returns none.
    await page.close();
    throw error;
  }
  const { ttiMs, clicks } = landed;
  const metrics = cdp ? await cdp.send('Performance.getMetrics') : { metrics: [] };
  /** The latest interaction's latency, once its paint has come. */
  const lastLatency = async () =>
    (
      await page.waitForFunction(() => window.__interactions.at(-1)?.latencyMs ?? false, null, {
        timeout: 5000,
      })
    ).jsonValue();
  const inpFirstMs = await lastLatency();
  const { undo } = interaction;
  if (undo === 'escape' && !cdp) {
    await page.keyboard.press('Escape');
  } else if (undo === 'escape') {
    for (const type of ['keyDown', 'keyUp']) {
      await cdp.send('Input.dispatchKeyEvent', {
        type,
        key: 'Escape',
        code: 'Escape',
        windowsVirtualKeyCode: 27,
      });
    }
  } else {
    await clickAt(undo === 'toggle' ? undefined : undo.click);
  }
  await page.waitForFunction((effect) => !window.__perfEffectShows(effect), interaction.effect, {
    timeout: 5000,
  });
  await driver.nextFrame();
  await driver.nextFrame();
  // The warm click resolves the trigger again: an undo may have replaced it (a dialog's Close).
  await page.evaluate(() => {
    window.__perfTrigger = undefined;
  });
  await clickAt();
  await page.waitForFunction((effect) => window.__perfEffectShows(effect), interaction.effect, {
    timeout: 5000,
  });
  const inpMs = await lastLatency();
  const scriptMs = (metrics.metrics.find((m) => m.name === 'ScriptDuration')?.value ?? 0) * 1000;
  const loaded = await page.evaluate(() => ({
    hydrateLoadCommitMs: window.__hydratedAt ?? null,
    bundleBytes: performance
      .getEntriesByType('resource')
      .filter((entry) => entry.initiatorType === 'script')
      .reduce((sum, entry) => sum + entry.encodedBodySize, 0),
  }));
  return { ttiMs, clicks, inpFirstMs, inpMs, scriptMs, ...loaded, page };
}

/**
 * Clicks once per frame until a click's effect appears.
 * @param {{ now: () => Promise<number>, click: () => Promise<void>, nextFrame: () => Promise<void>, effectSeen: () => Promise<boolean> }} driver
 *   `now` is milliseconds since navigation start.
 * @param {{ timeoutMs: number }} options
 * @returns {Promise<{ ttiMs: number, clicks: number }>} the landing click's time and the clicks sent
 */
export async function firstHandledClick(driver, { timeoutMs }) {
  let clicks = 0;
  for (;;) {
    const at = await driver.now();
    if (at > timeoutMs) {
      throw new Error(
        `${DEAD_TRIGGER}: no click took effect within ${timeoutMs} ms (${clicks} sent)`,
      );
    }
    await driver.click();
    clicks += 1;
    await driver.nextFrame();
    if (await driver.effectSeen()) {
      return { ttiMs: at, clicks };
    }
  }
}
