import { Legend, RadialBar, RadialBarChart, Tooltip } from "recharts"
import type { FC } from "react"

import { pageDataWithFillColor } from "../data"

export const RadialBarChartExample: FC = () => (
	<>
		<h1>RadialBarChart</h1>
		<p className="lead">Concentric ring chart over upstream `pageDataWithFillColor`.</p>
		<section className="chart-block">
			<h3>Age cohort distribution</h3>
			<RadialBarChart
				width={520}
				height={420}
				cx="50%"
				cy="50%"
				innerRadius="20%"
				outerRadius="80%"
				barSize={14}
				data={pageDataWithFillColor}
			>
				<RadialBar background dataKey="uv" />
				<Tooltip />
				<Legend
					iconSize={10}
					layout="vertical"
					verticalAlign="middle"
					align="right"
				/>
			</RadialBarChart>
		</section>
	</>
)
