import {
	Legend,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	RadarChart,
	Tooltip,
} from "@solidports/recharts"
import type { Component } from "solid-js"

import { subjectData } from "../data"

export const RadarChartExample: Component = () => (
	<>
		<h1>RadarChart</h1>
		<p class="lead">Two-series radar over upstream `subjectData`.</p>
		<section class="chart-block">
			<h3>Two-series</h3>
			<RadarChart width={520} height={420} data={subjectData}>
				<PolarGrid />
				<PolarAngleAxis dataKey="subject" />
				<PolarRadiusAxis angle={30} domain={[0, 150]} />
				<Tooltip />
				<Legend />
				<Radar
					name="Student A"
					dataKey="A"
					stroke="#4f46e5"
					fill="#4f46e5"
					fillOpacity={0.4}
				/>
				<Radar
					name="Student B"
					dataKey="B"
					stroke="#10b981"
					fill="#10b981"
					fillOpacity={0.4}
				/>
			</RadarChart>
		</section>
	</>
)
