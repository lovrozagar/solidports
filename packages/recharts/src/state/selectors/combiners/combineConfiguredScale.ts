/* eslint-disable import/no-cycle */
import * as d3Scales from "victory-vendor/d3-scale"
import { BaseCartesianAxis } from "../../cartesianAxisSlice"
import {
	CategoricalDomain,
	CategoricalDomainItem,
	D3ScaleType,
	NumberDomain,
} from "../../../util/types"
import { CustomScaleDefinition } from "../../../util/scale/CustomScaleDefinition"
import { AxisRange } from "../axisSelectors"
import { upperFirst } from "../../../util/DataUtils"

function lookupScale<Domain extends CategoricalDomainItem>(
	key: string,
): (() => CustomScaleDefinition<Domain>) | undefined {
	if (key in d3Scales) {
		const val: unknown = (d3Scales as Record<string, unknown>)[key]
		if (typeof val === "function") {
			return val as () => CustomScaleDefinition<Domain>
		}
	}
	return undefined
}

function getD3ScaleFromType<Domain extends CategoricalDomainItem = CategoricalDomainItem>(
	realScaleType: D3ScaleType,
): CustomScaleDefinition<Domain> | undefined {
	const direct = lookupScale<Domain>(realScaleType)
	if (direct != null) {
		return direct()
	}
	const prefixed = lookupScale<Domain>(`scale${upperFirst(realScaleType)}`)
	if (prefixed != null) {
		return prefixed()
	}
	return undefined
}

/**
 * Converts external scale definition into internal RechartsScale definition.
 * @param scale custom function scale - if you have the `string` from outside, use `combineRealScaleType` first which will validate it and return D3ScaleType or undefined
 * @param axisDomain
 * @param axisRange
 */
export function combineConfiguredScaleInternal(
	scale:
		| CustomScaleDefinition
		| CustomScaleDefinition<string>
		| CustomScaleDefinition<number>
		| CustomScaleDefinition<Date>,
	axisDomain: ReadonlyArray<CategoricalDomainItem>,
	axisRange: AxisRange,
): CustomScaleDefinition
export function combineConfiguredScaleInternal(
	scale: D3ScaleType,
	axisDomain: ReadonlyArray<CategoricalDomainItem>,
	axisRange: AxisRange,
): CustomScaleDefinition
export function combineConfiguredScaleInternal(
	scale: D3ScaleType | undefined,
	axisDomain: ReadonlyArray<CategoricalDomainItem>,
	axisRange: AxisRange,
): CustomScaleDefinition | undefined
export function combineConfiguredScaleInternal(
	scale: undefined,
	axisDomain: ReadonlyArray<CategoricalDomainItem>,
	axisRange: AxisRange,
): undefined
export function combineConfiguredScaleInternal<
	Domain extends CategoricalDomainItem = CategoricalDomainItem,
>(
	scale: D3ScaleType | CustomScaleDefinition<Domain> | undefined,
	axisDomain: ReadonlyArray<Domain>,
	axisRange: AxisRange,
): CustomScaleDefinition<Domain> | undefined
export function combineConfiguredScaleInternal<
	Domain extends CategoricalDomainItem = CategoricalDomainItem,
>(
	scale: D3ScaleType | CustomScaleDefinition<Domain> | undefined,
	axisDomain: ReadonlyArray<Domain>,
	axisRange: AxisRange,
): CustomScaleDefinition<Domain> | undefined {
	if (typeof scale === "function") {
		return scale.copy().domain(axisDomain).range(axisRange)
	}
	if (scale == null) {
		return undefined
	}
	const d3ScaleFunction: CustomScaleDefinition<Domain> | undefined = getD3ScaleFromType(scale)
	if (d3ScaleFunction == null) {
		return undefined
	}
	d3ScaleFunction.domain(axisDomain).range(axisRange)
	return d3ScaleFunction
}

export function combineConfiguredScale(
	axis: BaseCartesianAxis,
	realScaleType: D3ScaleType | undefined,
	axisDomain: NumberDomain | CategoricalDomain | undefined,
	axisRange: AxisRange | undefined,
): CustomScaleDefinition | undefined {
	if (axisDomain == null || axisRange == null) {
		return undefined
	}
	if (typeof axis.scale === "function") {
		return combineConfiguredScaleInternal(axis.scale, axisDomain, axisRange)
	}
	return combineConfiguredScaleInternal(realScaleType, axisDomain, axisRange)
}
