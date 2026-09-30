import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Tooltip,
	XAxis,
	YAxis,
} from "@solidports/recharts"
import type { Component } from "solid-js"

import { pageData } from "../data"

export const BarChartExample: Component = () => (
	<>
		<h1>BarChart</h1>
		<p class="lead">Grouped + stacked bars over upstream `pageData`.</p>
		<section class="chart-block">
			<h3>Grouped</h3>
			<BarChart
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
				<Bar dataKey="uv" fill="#4f46e5" />
				<Bar dataKey="pv" fill="#10b981" />
			</BarChart>
		</section>
		<section class="chart-block">
			<h3>Stacked</h3>
			<BarChart
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
				<Bar dataKey="pv" stackId="a" fill="#10b981" />
				<Bar dataKey="amt" stackId="a" fill="#ef4444" />
			</BarChart>
		</section>
	</>
)
