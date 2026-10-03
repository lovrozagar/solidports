// Phase-0-compatible cold mount + animation rAF bench, plus CDP main-thread totals.
import { chromium } from "playwright"
const FW = { solid: "http://localhost:5193", react: "http://localhost:5184" }
const SEL = { line: ".recharts-line .recharts-curve", bar: ".recharts-bar-rectangle", area: ".recharts-area .recharts-curve", composed: ".recharts-line .recharts-curve", pie: ".recharts-pie-sector", radar: ".recharts-radar-polygon", radial: ".recharts-radial-bar-sector", scatter: ".recharts-scatter-symbol", funnel: ".recharts-funnel-trapezoid", sankey: ".recharts-sankey-node", treemap: ".recharts-treemap-depth-1 .recharts-rectangle", sunburst: ".recharts-sunburst .recharts-sector" }
const PASSES = +(process.env.PASSES ?? 5), WINDOW = 2500
const ONLY = process.env.ROUTES?.split(",")
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1)
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0 }
const browser = await chromium.launch()
const out = {}
for (const [r, sel] of Object.entries(SEL).filter(([r]) => !ONLY || ONLY.includes(r))) for (let i = 0; i < PASSES; i++) for (const fw of i % 2 ? ["react", "solid"] : ["solid", "react"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    window.__raf = []
    const orig = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => orig((t) => { const s = performance.now(); cb(t); window.__raf.push(performance.now() - s) })
  })
  const cdp = await ctx.newCDPSession(page); await cdp.send("Performance.enable")
  const t0 = Date.now()
  await page.goto(`${FW[fw]}/#/${r}`)
  await page.waitForSelector(sel, { timeout: 10000 })
  const tFirstPaint = Date.now() - t0
  const fcp = await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0)
  await page.waitForTimeout(WINDOW)
  const raf = await page.evaluate(() => window.__raf)
  const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]))
  ;((out[r] ??= {})[fw] ??= []).push({ tFirstPaint, fcp, rafCount: raf.length, avgRafMs: avg(raf), p95RafMs: pct(raf, 0.95), maxRafMs: Math.max(0, ...raf), totalRafMs: raf.reduce((a, b) => a + b, 0), scriptMs: m.ScriptDuration * 1000, taskMs: m.TaskDuration * 1000, layoutMs: m.LayoutDuration * 1000, recalcStyleMs: m.RecalcStyleDuration * 1000, heapMB: m.JSHeapUsedSize / 1048576, nodes: m.Nodes })
  await ctx.close()
}
await browser.close()
const res = { measuredAt: new Date().toISOString(), passes: PASSES, windowMs: WINDOW, viewport: { width: 1280, height: 720 }, routes: Object.entries(out).map(([id, v]) => ({ id, selector: SEL[id], ...Object.fromEntries(Object.entries(v).map(([fw, xs]) => [fw, Object.fromEntries(Object.keys(xs[0]).map((k) => [k, +avg(xs.map((x) => x[k])).toFixed(4)]))])) })) }
console.log(JSON.stringify(res, null, 2))
