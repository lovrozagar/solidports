import { Sankey, Tooltip } from "@solidports/recharts"
import type { Component } from 'solid-js';
import { nodeLinkData } from "../data"

export const SankeyChartExample: Component = () => (
	<>
		<h1>SankeyChart</h1>
		<p class="lead">Visitor flow via upstream `nodeLinkData`.</p>
		<section class="chart-block">
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
