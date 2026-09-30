import { SunburstChart } from "@solidports/recharts"
import type { Component } from "solid-js"

import { sunburstHierarchy } from "../data"

export const SunburstChartExample: Component = () => (
	<>
		<h1>SunburstChart</h1>
		<p class="lead">Upstream Sunburst API hierarchy.</p>
		<section class="chart-block">
			<h3>Multi-level hierarchy</h3>
			<SunburstChart
				width={520}
				height={520}
				data={sunburstHierarchy}
				dataKey="value"
				innerRadius={40}
				startAngle={90}
				endAngle={270}
			/>
		</section>
	</>
)
