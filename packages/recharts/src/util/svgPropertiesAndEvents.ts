import { isEventKey } from "./excludeEventProps"
import { ownStringKeys, svgPropCanonicalKey } from "./svgPropertiesNoEvents"
import type { DataAttributeKeyType, SVGElementPropKeysType } from "./svgPropertiesNoEvents"
import type { EventKeysType } from "./excludeEventProps"

type SVGElementPropsAndEventsType = SVGElementPropKeysType | EventKeysType | DataAttributeKeyType

export type SVGPropsAndEvents<T> = Pick<T, Extract<keyof T, SVGElementPropsAndEventsType>>

/**
 * Filters an object to only include SVG properties, data attributes, and event handlers.
 * @param obj - The object to filter.
 * @returns A new object containing only valid SVG properties, data attributes, and event handlers.
 */
export function svgPropertiesAndEvents<T extends object>(obj: T): SVGPropsAndEvents<T> {
	const result: Record<PropertyKey, unknown> = {}
	for (const key of ownStringKeys(obj)) {
		const canonical = svgPropCanonicalKey(key)
		if (canonical !== undefined) {
			result[canonical] = (obj as Record<string, unknown>)[key]
		} else if (isEventKey(key)) {
			/* Event handler keys (onClick etc.) keep their camelCase — Solid uses
			 * delegation via the original prop name. */
			result[key] = (obj as Record<string, unknown>)[key]
		}
	}
	return result as SVGPropsAndEvents<T>
}

/**
 * Function to filter SVG properties from various input types.
 * The input types can be:
 * - A record of string keys to any values, in which case it returns a record of only SVG properties
 * - Anything else, in which case it returns null
 *
 * This function has a wide-open return type, because it will read and filter the props of an arbitrary element.
 *
 * If you wish to have a type-safe version, use svgPropertiesNoEvents directly with a typed object.
 *
 * @param input - The input to filter, which can be a record or other types.
 * @returns A record of SVG properties if the input is a record, otherwise null.
 */
export function svgPropertiesAndEventsFromUnknown(input: unknown): Record<string, unknown> | null {
	if (input == null) {
		return null
	}

	if (typeof input === "object" && !Array.isArray(input)) {
		return svgPropertiesAndEvents(input as Record<PropertyKey, unknown>)
	}

	return null
}
