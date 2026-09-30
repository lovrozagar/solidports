import { useId } from "./useId"

/**
 * Generates a unique ID. It uses Solid's createUniqueId() for SSR safety.
 *
 * The ID will stay the same across renders, and you can optionally provide a prefix.
 *
 * @param [prefix] - An optional prefix for the generated ID.
 * @param [customId] - An optional custom ID to override the generated one.
 * @returns The unique ID.
 */
export function useUniqueId(prefix?: string, customId?: string): string {
	const generatedId = useId()

	if (customId) {
		return customId
	}

	return prefix ? `${prefix}-${generatedId}` : generatedId
}

/**
 * The useUniqueId hook returns a unique ID that is either reused from external props or generated internally.
 * Either way the ID is now guaranteed to be present so no more nulls or undefined.
 */
export type WithIdRequired<T> = T & {
	id: string
}

export type WithoutId<T> = Omit<T, "id">
