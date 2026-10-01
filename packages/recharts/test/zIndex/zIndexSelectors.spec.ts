import { describe, it, expect } from "vitest"
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
			actions.registerZIndexPortalElement({
				element: element2,
				isPanorama: false,
				zIndex: -1,
			})

			expect(selectZIndexPortalElement(store, 1, false)).toBe(element1)
			expect(selectZIndexPortalElement(store, -1, false)).toBe(element2)

			actions.unregisterZIndexPortalElement({
				isPanorama: false,
				zIndex: 1,
			})
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
			actions.registerZIndexPortalElement({
				element: panoramaElement,
				isPanorama: true,
				zIndex: 10,
			})

			expect(selectZIndexPortalElement(store, 10, false)).toBe(mainElement)
			expect(selectZIndexPortalElement(store, 10, true)).toBe(panoramaElement)
		})
	})
	describe("selectAllRegisteredZIndexes", () => {
		it.skip("should select all registered zIndexes correctly", () => {
			const [store, setStore] = createRechartsStore()
			const actions = createActions(store, setStore)

			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			actions.registerZIndexPortal({ zIndex: 2 })
			actions.registerZIndexPortal({ zIndex: -3 })
			actions.registerZIndexPortal({ zIndex: 1 })

			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, -3, 1, 2, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			actions.unregisterZIndexPortal({ zIndex: 1 })
			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, -3, 2, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			actions.unregisterZIndexPortal({ zIndex: -3 })
			actions.unregisterZIndexPortal({ zIndex: 2 })
			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])
		})
		it("should not duplicate zIndex when registered multiple times", () => {
			const [store, setStore] = createRechartsStore()
			const actions = createActions(store, setStore)

			actions.registerZIndexPortal({ zIndex: 50 })
			const firstSelection = selectAllRegisteredZIndexes(store)
			expect(firstSelection).toEqual([
				-100, -50, 50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			actions.registerZIndexPortal({ zIndex: 50 })
			const secondSelection = selectAllRegisteredZIndexes(store)
			expect(secondSelection).toEqual([
				-100, -50, 50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])
		})
	})
})
