import {
	CartesianGrid,
	Legend,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts"
import type { FC } from "react"

import { coordinateData, coordinateWithValueData } from "../data"

export const ScatterChartExample: FC = () => (
	<>
		<h1>ScatterChart</h1>
		<p className="lead">Two scatter sets with z-axis sized bubbles. Upstream coordinates.</p>
		<section className="chart-block">
			<h3>X / Y / Z</h3>
			<ScatterChart
				width={720}
				height={360}
				margin={{ top: 16, right: 24, left: 0, bottom: 0 }}
			>
				<CartesianGrid />
				<XAxis type="number" dataKey="x" name="X" />
				<YAxis type="number" dataKey="y" name="Y" />
				<ZAxis type="number" dataKey="value" range={[60, 400]} name="weight" />
				<Tooltip cursor={{ strokeDasharray: "3 3" }} />
				<Legend />
				<Scatter name="Set A" data={coordinateData} fill="#4f46e5" />
				<Scatter name="Set B" data={coordinateWithValueData} fill="#10b981" />
			</ScatterChart>
		</section>
	</>
)
