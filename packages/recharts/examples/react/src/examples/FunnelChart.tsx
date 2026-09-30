import { Funnel, FunnelChart, LabelList, Tooltip } from "recharts"
import type { FC } from "react"

import { funnelData } from "../data"

export const FunnelChartExample: FC = () => (
	<>
		<h1>FunnelChart</h1>
		<p className="lead">Upstream Funnel API story sample data.</p>
		<section className="chart-block">
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
