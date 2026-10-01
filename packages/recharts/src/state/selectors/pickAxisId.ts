import { ChartState } from "../store"
import { AxisId } from "../cartesianAxisSlice"

export const pickAxisId = (_state: ChartState, _axisType: unknown, axisId: AxisId): AxisId =>
	axisId
