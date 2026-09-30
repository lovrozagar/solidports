import {
	Legend,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	RadarChart,
	Tooltip,
} from "recharts"
import type { FC } from "react"

import { subjectData } from "../data"

export const RadarChartExample: FC = () => (
	<>
		<h1>RadarChart</h1>
		<p className="lead">Two-series radar over upstream `subjectData`.</p>
		<section className="chart-block">
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
