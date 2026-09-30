import { createUniqueId } from "solid-js"

/**
 * Generates a unique ID using Solid's createUniqueId.
 * This is SSR-safe in Solid.
 *
 * @returns A unique ID that remains consistent across renders.
 */
export const useId: () => string = createUniqueId
