import { Funnel, FunnelChart, LabelList, Tooltip } from "@solidports/recharts"
import type { Component } from "solid-js"

import { funnelData } from "../data"

export const FunnelChartExample: Component = () => (
	<>
		<h1>FunnelChart</h1>
		<p class="lead">Upstream Funnel API story sample data.</p>
		<section class="chart-block">
			<h3>Acquisition funnel</h3>
			<FunnelChart width={520} height={360}>
				<Tooltip />
				<Funnel dataKey="value" data={funnelData} isAnimationActive>
					<LabelList position="right" fill="#1a1a1a" stroke="none" dataKey="name" />
				</Funnel>
			</FunnelChart>
		</section>
	</>
)
