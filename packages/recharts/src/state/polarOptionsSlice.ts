export type PolarChartOptions = {
	cx: number | string
	cy: number | string
	endAngle: number
	innerRadius: number | string
	outerRadius: number | string
	startAngle: number
}

export type PolarChartState = PolarChartOptions | null

export const initialPolarOptionsState: PolarChartState = null
