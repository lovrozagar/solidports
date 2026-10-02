import { Cell, Legend, Pie, PieChart, Tooltip } from "@solidports/recharts"
import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { pageData, pieColors } from "../data"

export const PieChartExample: Component = () => (
	<>
		<h1>PieChart</h1>
		<p class="lead">Solid pie + donut over upstream `pageData` (uv).</p>
		<section class="chart-block">
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
					<For each={pageData}>
						{(_, i) => <Cell fill={pieColors[i() % pieColors.length]} />}
					</For>
				</Pie>
			</PieChart>
		</section>
		<section class="chart-block">
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
					<For each={pageData}>
						{(_, i) => <Cell fill={pieColors[i() % pieColors.length]} />}
					</For>
				</Pie>
			</PieChart>
		</section>
	</>
)
