import { createSignal, For, onCleanup, onSettled, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { AreaChartExample } from "./examples/AreaChart"
import { BarChartExample } from "./examples/BarChart"
import { ComposedChartExample } from "./examples/ComposedChart"
import { FunnelChartExample } from "./examples/FunnelChart"
import { LineChartExample } from "./examples/LineChart"
import { PieChartExample } from "./examples/PieChart"
import { RadarChartExample } from "./examples/RadarChart"
import { RadialBarChartExample } from "./examples/RadialBarChart"
import { SankeyChartExample } from "./examples/SankeyChart"
import { ScatterChartExample } from "./examples/ScatterChart"
import { SunburstChartExample } from "./examples/SunburstChart"
import { TreemapChartExample } from "./examples/TreemapChart"

type Route = {
	id: string
	label: string
	view: Component
}

const routes: ReadonlyArray<Route> = [
	{ id: "line", label: "LineChart", view: LineChartExample },
	{ id: "bar", label: "BarChart", view: BarChartExample },
	{ id: "area", label: "AreaChart", view: AreaChartExample },
	{ id: "composed", label: "ComposedChart", view: ComposedChartExample },
	{ id: "pie", label: "PieChart", view: PieChartExample },
	{ id: "radar", label: "RadarChart", view: RadarChartExample },
	{ id: "radial", label: "RadialBarChart", view: RadialBarChartExample },
	{ id: "scatter", label: "ScatterChart", view: ScatterChartExample },
	{ id: "funnel", label: "FunnelChart", view: FunnelChartExample },
	{ id: "sankey", label: "SankeyChart", view: SankeyChartExample },
	{ id: "treemap", label: "TreemapChart", view: TreemapChartExample },
	{ id: "sunburst", label: "SunburstChart", view: SunburstChartExample },
]

const fallbackId = routes[0]?.id ?? "line"

function readHashId(): string {
	const raw = window.location.hash.replace(/^#\/?/, "")
	return routes.some((r) => r.id === raw) ? raw : fallbackId
}

export const App: Component = () => {
	const [activeId, setActiveId] = createSignal(fallbackId)

	onSettled(() => {
		setActiveId(readHashId())
		const onHash = () => setActiveId(readHashId())
		window.addEventListener("hashchange", onHash)
		onCleanup(() => window.removeEventListener("hashchange", onHash))
	})

	return (
		<>
			<aside class="sidebar">
				<h2>Charts</h2>
				<nav>
					<For each={routes}>
						{(route) => (
							<a
								href={`#/${route.id}`}
								class={{ active: activeId() === route.id }}
							>
								{route.label}
							</a>
						)}
					</For>
				</nav>
			</aside>
			<main>
				<For each={routes}>
					{(route) => (
						<Show when={activeId() === route.id}>
							{(() => {
								const View = route.view
								return <View />
							})()}
						</Show>
					)}
				</For>
			</main>
		</>
	)
}
