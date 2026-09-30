import { Sankey, Tooltip } from "recharts"
import type { FC } from "react"

import { nodeLinkData } from "../data"

export const SankeyChartExample: FC = () => (
	<>
		<h1>SankeyChart</h1>
		<p className="lead">Visitor flow via upstream `nodeLinkData`.</p>
		<section className="chart-block">
			<h3>Visitor flow</h3>
			<Sankey
				width={720}
				height={420}
				data={nodeLinkData}
				nodePadding={50}
				margin={{ top: 16, right: 24, left: 24, bottom: 16 }}
				link={{ stroke: "#83a6ed" }}
			>
				<Tooltip />
			</Sankey>
		</section>
	</>
)
