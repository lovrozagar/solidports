import {
	Area,
	AreaChart,
	CartesianGrid,
	Legend,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import type { FC } from "react"

import { pageData } from "../data"

export const AreaChartExample: FC = () => (
	<>
		<h1>AreaChart</h1>
		<p className="lead">Overlay + stacked areas over upstream `pageData`.</p>
		<section className="chart-block">
			<h3>Overlay</h3>
			<AreaChart
				width={720}
				height={320}
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
					dataKey="pv"
					stroke="#ef4444"
					fill="#ef4444"
					fillOpacity={0.25}
				/>
				<Area
					type="monotone"
					dataKey="uv"
					stroke="#4f46e5"
					fill="#4f46e5"
					fillOpacity={0.25}
				/>
			</AreaChart>
		</section>
		<section className="chart-block">
			<h3>Stacked</h3>
			<AreaChart
				width={720}
				height={320}
				data={pageData}
				margin={{ top: 16, right: 24, left: 0, bottom: 0 }}
			>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis dataKey="name" />
				<YAxis />
				<Tooltip />
				<Legend />
				<Area type="monotone" dataKey="uv" stackId="t" stroke="#4f46e5" fill="#4f46e5" />
				<Area type="monotone" dataKey="pv" stackId="t" stroke="#ef4444" fill="#ef4444" />
			</AreaChart>
		</section>
	</>
)
