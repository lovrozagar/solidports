import { Tooltip, Treemap } from "@solidports/recharts"
import type { Component } from "solid-js"

import { treemapData } from "../data"

export const TreemapChartExample: Component = () => (
	<>
		<h1>Treemap</h1>
		<p class="lead">Upstream `treemapData` laid out by area.</p>
		<section class="chart-block">
			<h3>Module sizes</h3>
			<Treemap
				width={720}
				height={420}
				data={treemapData}
				dataKey="size"
				stroke="#fff"
				fill="#4f46e5"
			>
				<Tooltip />
			</Treemap>
		</section>
	</>
)
