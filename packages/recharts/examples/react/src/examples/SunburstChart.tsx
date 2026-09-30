import { SunburstChart } from "recharts"
import type { FC } from "react"

import { sunburstHierarchy } from "../data"

export const SunburstChartExample: FC = () => (
	<>
		<h1>SunburstChart</h1>
		<p className="lead">Upstream Sunburst API hierarchy.</p>
		<section className="chart-block">
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
