import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	Tooltip,
	XAxis,
	YAxis,
} from "@solidports/recharts"
import type { Component } from "solid-js"

import { pageData } from "../data"

export const LineChartExample: Component = () => (
	<>
		<h1>LineChart</h1>
		<p class="lead">Page metrics — straight + monotone variants. Upstream `pageData`.</p>
		<section class="chart-block">
			<h3>Straight lines</h3>
			<LineChart
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
				<Line type="linear" dataKey="uv" stroke="#4f46e5" strokeWidth={2} dot />
				<Line type="linear" dataKey="pv" stroke="#10b981" strokeWidth={2} dot />
				<Line type="linear" dataKey="amt" stroke="#ef4444" strokeWidth={2} dot />
			</LineChart>
		</section>
		<section class="chart-block">
			<h3>Smooth (monotone)</h3>
			<LineChart
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
				<Line type="monotone" dataKey="uv" stroke="#4f46e5" strokeWidth={2} />
				<Line type="monotone" dataKey="pv" stroke="#10b981" strokeWidth={2} />
			</LineChart>
		</section>
	</>
)
