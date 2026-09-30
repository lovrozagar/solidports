import { Tooltip, Treemap } from "recharts"
import type { FC } from "react"

import { treemapData } from "../data"

export const TreemapChartExample: FC = () => (
	<>
		<h1>Treemap</h1>
		<p className="lead">Upstream `treemapData` laid out by area.</p>
		<section className="chart-block">
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
