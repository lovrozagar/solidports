import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts"
import type { FC } from "react"

import { pageData, pieColors } from "../data"

export const PieChartExample: FC = () => (
	<>
		<h1>PieChart</h1>
		<p className="lead">Solid pie + donut over upstream `pageData` (uv).</p>
		<section className="chart-block">
			<h3>Pie</h3>
			<PieChart width={480} height={320}>
				<Tooltip />
				<Legend />
				<Pie
					data={pageData}
					dataKey="uv"
					nameKey="name"
					cx="50%"
					cy="50%"
					outerRadius={110}
					label
				>
					{pageData.map((entry, i) => (
						<Cell key={entry.name} fill={pieColors[i % pieColors.length]} />
					))}
				</Pie>
			</PieChart>
		</section>
		<section className="chart-block">
			<h3>Donut</h3>
			<PieChart width={480} height={320}>
				<Tooltip />
				<Legend />
				<Pie
					data={pageData}
					dataKey="uv"
					nameKey="name"
					cx="50%"
					cy="50%"
					innerRadius={60}
					outerRadius={110}
					paddingAngle={2}
				>
					{pageData.map((entry, i) => (
						<Cell key={entry.name} fill={pieColors[i % pieColors.length]} />
					))}
				</Pie>
			</PieChart>
		</section>
	</>
)
