import { describe, it, expect } from "vitest"
import { flush } from "solid-js"
import { createRechartsStore } from "../../src/state/store"
import { createActions } from "../../src/state/actions"

import {
	selectZIndexPortalElement,
	selectAllRegisteredZIndexes,
} from "../../src/zIndex/zIndexSelectors"

describe("zIndexSelectors", () => {
	describe("selectZIndexPortalElement", () => {
		it("should select zIndex portal elements correctly", () => {
			const [store, setStore] = createRechartsStore()
			const actions = createActions(store, setStore)

			expect(selectZIndexPortalElement(store, 1, false)).toBeUndefined()
			expect(selectZIndexPortalElement(store, -1, false)).toBeUndefined()

			const element1 = document.createElement("div")
			const element2 = document.createElement("div")
			actions.registerZIndexPortalElement({
				element: element1,
				isPanorama: false,
				zIndex: 1,
			})
			flush()
			actions.registerZIndexPortalElement({
				element: element2,
				isPanorama: false,
				zIndex: -1,
			})
			flush()

			expect(selectZIndexPortalElement(store, 1, false)).toBe(element1)
			expect(selectZIndexPortalElement(store, -1, false)).toBe(element2)

			actions.unregisterZIndexPortalElement({
				isPanorama: false,
				zIndex: 1,
			})

			flush()
			expect(selectZIndexPortalElement(store, 1, false)).toBeUndefined()
			expect(selectZIndexPortalElement(store, -1, false)).toBe(element2)
		})
		it("should return undefined for undefined zIndex", () => {
			const [store] = createRechartsStore()
			expect(selectZIndexPortalElement(store, undefined, true)).toBeUndefined()
			expect(selectZIndexPortalElement(store, undefined, false)).toBeUndefined()
		})
		it("should differentiate between panorama and main chart", () => {
			const [store, setStore] = createRechartsStore()
			const actions = createActions(store, setStore)

			const mainElement = document.createElement("div")
			const panoramaElement = document.createElement("div")
			actions.registerZIndexPortalElement({
				element: mainElement,
				isPanorama: false,
				zIndex: 10,
			})
			flush()
			actions.registerZIndexPortalElement({
				element: panoramaElement,
				isPanorama: true,
				zIndex: 10,
			})
			flush()

			expect(selectZIndexPortalElement(store, 10, false)).toBe(mainElement)
			expect(selectZIndexPortalElement(store, 10, true)).toBe(panoramaElement)
		})
	})
	describe("selectAllRegisteredZIndexes", () => {
		it("should select all registered zIndexes correctly", () => {
			const [store, setStore] = createRechartsStore()
			const actions = createActions(store, setStore)

			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			actions.registerZIndexPortal({ zIndex: 2 })
			flush()
			actions.registerZIndexPortal({ zIndex: -3 })
			flush()
			actions.registerZIndexPortal({ zIndex: 1 })
			flush()

			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, -3, 1, 2, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			actions.unregisterZIndexPortal({ zIndex: 1 })
			flush()
			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, -3, 2, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			actions.unregisterZIndexPortal({ zIndex: -3 })
			flush()
			actions.unregisterZIndexPortal({ zIndex: 2 })
			flush()
			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])
		})
		it("should memoize results based on array contents", () => {
			const [store, setStore] = createRechartsStore()
			const actions = createActions(store, setStore)

			actions.registerZIndexPortal({ zIndex: 5 })
			actions.registerZIndexPortal({ zIndex: 10 })
			flush()

			const firstSelection = selectAllRegisteredZIndexes(store)
			const secondSelection = selectAllRegisteredZIndexes(store)

			expect(firstSelection).toBe(secondSelection) // Same reference due to memoization

			actions.registerZIndexPortal({ zIndex: 15 })
			flush()

			const thirdSelection = selectAllRegisteredZIndexes(store)
			expect(thirdSelection).not.toBe(firstSelection) // Different reference after state change
			expect(thirdSelection).toEqual([
				-100, -50, 5, 10, 15, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			// now, the portal element has been registered, but the zIndex list should remain the same
			const element1 = document.createElement("div")
			const element2 = document.createElement("div")
			actions.registerZIndexPortalElement({ element: element1, isPanorama: false, zIndex: 5 })
			actions.registerZIndexPortalElement({ element: element2, isPanorama: true, zIndex: 5 })
			flush()
			const fourthSelection = selectAllRegisteredZIndexes(store)
			expect(fourthSelection).toBe(thirdSelection) // Same reference due to memoization
		})
		it("should not duplicate zIndex when registered multiple times", () => {
			const [store, setStore] = createRechartsStore()
			const actions = createActions(store, setStore)

			actions.registerZIndexPortal({ zIndex: 50 })
			flush()
			const firstSelection = selectAllRegisteredZIndexes(store)
			expect(firstSelection).toEqual([
				-100, -50, 50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			actions.registerZIndexPortal({ zIndex: 50 })
			flush()
			const secondSelection = selectAllRegisteredZIndexes(store)
			expect(secondSelection).toEqual([
				-100, -50, 50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])
			expect(secondSelection).toBe(firstSelection) // Should be memoized, no change
		})

		it("should not affect zIndex list when only registering/unregistering portal element", () => {
			const [store, setStore] = createRechartsStore()
			const actions = createActions(store, setStore)

			const initialSelection = selectAllRegisteredZIndexes(store)
			expect(initialSelection).toEqual([-100, -50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000])

			// Register a portal element for a default zIndex without registering the zIndex itself
			const element = document.createElement("div")
			actions.registerZIndexPortalElement({ element, isPanorama: false, zIndex: 100 })
			flush()
			const afterRegister = selectAllRegisteredZIndexes(store)
			// The zIndex list should remain unchanged
			expect(afterRegister).toEqual([-100, -50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000])
			// With resultEqualityCheck, the reference should be preserved when contents match
			expect(afterRegister).toBe(initialSelection)

			// Unregister the portal element
			actions.unregisterZIndexPortalElement({ isPanorama: false, zIndex: 100 })
			flush()
			const afterUnregister = selectAllRegisteredZIndexes(store)
			// The zIndex list should still remain unchanged
			expect(afterUnregister).toEqual([-100, -50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000])
			// Reference should still be preserved
			expect(afterUnregister).toBe(initialSelection)
		})
	})
})
