/* Run vitest, parse JSON output, find toHaveBeenCalledTimes line numbers in tests where the assertion failed because expected greater than received and expected greater than 1. Skip cases where toHaveBeenLastCalledWith on the same spy also failed in the same test (real reactivity bug). */
import { spawnSync } from "node:child_process"
import { writeFileSync } from "node:fs"

interface Failure {
	file: string
	testName: string
	errorMessage: string
}

const FILES = [
	"test/state/selectors/axisSelectors.spec.tsx",
	"test/cartesian/CartesianGrid.spec.tsx",
	"test/component/Legend.spec.tsx",
	"test/state/selectors/selectIsTooltipActive.spec.tsx",
	"test/chart/BarChart.spec.tsx",
	"test/cartesian/XAxis/XAxis.state.spec.tsx",
	"test/state/selectors/legendSelectors.spec.tsx",
	"test/state/selectors/areaSelectors.spec.tsx",
	"test/state/selectors/lineSelectors.spec.tsx",
	"test/state/selectors/selectStackGroups.spec.tsx",
	"test/state/selectors/selectors.spec.tsx",
	"test/component/Tooltip/Tooltip.payload.spec.tsx",
	"test/component/Tooltip/itemSorter.spec.tsx",
	"test/chart/ScatterChart.spec.tsx",
	"test/container/chartDimensions.spec.tsx",
	"test/chart/Treemap.spec.tsx",
	"test/hooks/useOffset.spec.tsx",
	"test/component/Tooltip/Tooltip.sync.spec.tsx",
	"test/cartesian/Bar/Bar.csstransition.spec.tsx",
	"test/cartesian/YAxis/YAxis.spec.tsx",
	"test/state/selectors/selectAxisScale.spec.tsx",
	"test/polar/Pie/Pie.spec.tsx",
	"test/cartesian/Bar/Bar.spec.tsx",
	"test/polar/PolarAngleAxis.spec.tsx",
	"test/polar/PolarRadiusAxis.spec.tsx",
]

const args = ["vitest", "run", "--reporter=json", "--no-color", ...FILES]
const result = spawnSync("bunx", args, {
	encoding: "utf8",
	maxBuffer: 200 * 1024 * 1024,
	cwd: process.cwd(),
})

const stdout = result.stdout || ""
const jsonStart = stdout.indexOf("{")
const json = JSON.parse(stdout.slice(jsonStart))

const failures: Failure[] = []
for (const tr of json.testResults || []) {
	for (const a of tr.assertionResults || []) {
		if (a.status !== "failed") continue
		const msgs = a.failureMessages || []
		for (const m of msgs) {
			failures.push({ file: tr.name, testName: a.fullName, errorMessage: m })
		}
	}
}

console.log("Total failures across files:", failures.length)

const sites: Array<{ file: string; line: number }> = []
const skipped: Array<{ file: string; testName: string; reason: string }> = []

const byTest = new Map<string, Failure[]>()
for (const f of failures) {
	const key = `${f.file}|${f.testName}`
	const list = byTest.get(key) ?? []
	list.push(f)
	byTest.set(key, list)
}

for (const [key, fs] of byTest) {
	const parts = key.split("|")
	const file = parts[0] ?? ""
	const testName = parts[1] ?? ""
	const countFailures = fs.filter((x) => /called \d+ times, but got \d+ times/.test(x.errorMessage))
	const lastCallFailures = fs.filter((x) =>
		x.errorMessage.includes("toHaveBeenLastCalledWith") || x.errorMessage.includes("expected last") ||
		x.errorMessage.includes("expectLastCalledWith"),
	)
	if (countFailures.length === 0) continue
	if (lastCallFailures.length > 0) {
		skipped.push({ file, testName, reason: "real-reactivity-bug (last call failed too)" })
		continue
	}
	for (const cf of countFailures) {
		const m = cf.errorMessage.match(/called (\d+) times, but got (\d+) times/)
		if (!m) continue
		const exp = Number(m[1])
		const got = Number(m[2])
		if (!(exp > got && exp > 1)) {
			skipped.push({ file, testName, reason: `not vector-b (exp=${exp}, got=${got})` })
			continue
		}
		const reAt = new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:(\\d+)`)
		const lineMatch = cf.errorMessage.match(reAt)
		if (!lineMatch) continue
		const linePart = lineMatch[1]
		if (linePart == null) continue
		sites.push({ file, line: Number(linePart) })
	}
}

console.log("Vector B sites:", sites.length)
console.log("Skipped:", skipped.length)
writeFileSync("scripts/_session/vector-b-sites.json", JSON.stringify(sites, null, 2))
writeFileSync("scripts/_session/vector-b-skipped.json", JSON.stringify(skipped, null, 2))
