import {
	Area,
	Bar,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import type { FC } from "react"

import { pageData } from "../data"

export const ComposedChartExample: FC = () => (
	<>
		<h1>ComposedChart</h1>
		<p className="lead">Bars, lines, area sharing one cartesian space. Upstream `pageData`.</p>
		<section className="chart-block">
			<h3>Bar + Line + Area</h3>
			<ComposedChart
				width={720}
				height={360}
				data={pageData}
				margin={{ top: 16, right: 24, left: 0, bottom: 0 }}
			>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis dataKey="name" />
				<YAxis />
				<Tooltip />
				<Legend />
				<Area
					type="monotone"
					dataKey="amt"
					fill="#ef4444"
					stroke="#ef4444"
					fillOpacity={0.2}
				/>
				<Bar dataKey="pv" barSize={20} fill="#10b981" />
				<Line type="monotone" dataKey="uv" stroke="#4f46e5" strokeWidth={2} />
			</ComposedChart>
		</section>
	</>
)
