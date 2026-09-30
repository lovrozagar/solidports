import { describe, it, expect } from "vitest"
import { createRechartsStore } from "../../src/state/store"

import {
	selectZIndexPortalElement,
	selectAllRegisteredZIndexes,
} from "../../src/zIndex/zIndexSelectors"
import {
	registerZIndexPortal,
	registerZIndexPortalElement,
	unregisterZIndexPortal,
	unregisterZIndexPortalElement,
} from "../../src/state/zIndexSlice"

describe("zIndexSelectors", () => {
	describe("selectZIndexPortalElement", () => {
		it("should select zIndex portal elements correctly", () => {
			const [store, setStore] = createRechartsStore()

			expect(selectZIndexPortalElement(store, 1, false)).toBeUndefined()
			expect(selectZIndexPortalElement(store, -1, false)).toBeUndefined()

			const element1 = document.createElement("div")
			const element2 = document.createElement("div")
			registerZIndexPortalElement({
				element: element1,
				isPanorama: false,
				zIndex: 1,
			})(setStore, store)
			registerZIndexPortalElement({
				element: element2,
				isPanorama: false,
				zIndex: -1,
			})(setStore, store)

			expect(selectZIndexPortalElement(store, 1, false)).toBe(element1)
			expect(selectZIndexPortalElement(store, -1, false)).toBe(element2)

			unregisterZIndexPortalElement({
				isPanorama: false,
				zIndex: 1,
			})(setStore, store)
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

			const mainElement = document.createElement("div")
			const panoramaElement = document.createElement("div")
			registerZIndexPortalElement({
				element: mainElement,
				isPanorama: false,
				zIndex: 10,
			})(setStore, store)
			registerZIndexPortalElement({
				element: panoramaElement,
				isPanorama: true,
				zIndex: 10,
			})(setStore, store)

			expect(selectZIndexPortalElement(store, 10, false)).toBe(mainElement)
			expect(selectZIndexPortalElement(store, 10, true)).toBe(panoramaElement)
		})
	})
	describe("selectAllRegisteredZIndexes", () => {
		it.skip("should select all registered zIndexes correctly", () => {
			const [store, setStore] = createRechartsStore()

			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			registerZIndexPortal({ zIndex: 2 })(setStore, store)
			registerZIndexPortal({ zIndex: -3 })(setStore, store)
			registerZIndexPortal({ zIndex: 1 })(setStore, store)

			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, -3, 1, 2, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			unregisterZIndexPortal({ zIndex: 1 })(setStore, store)
			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, -3, 2, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			unregisterZIndexPortal({ zIndex: -3 })(setStore, store)
			unregisterZIndexPortal({ zIndex: 2 })(setStore, store)
			expect(selectAllRegisteredZIndexes(store)).toEqual([
				-100, -50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])
		})
		it("should not duplicate zIndex when registered multiple times", () => {
			const [store, setStore] = createRechartsStore()

			registerZIndexPortal({ zIndex: 50 })(setStore, store)
			const firstSelection = selectAllRegisteredZIndexes(store)
			expect(firstSelection).toEqual([
				-100, -50, 50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])

			registerZIndexPortal({ zIndex: 50 })(setStore, store)
			const secondSelection = selectAllRegisteredZIndexes(store)
			expect(secondSelection).toEqual([
				-100, -50, 50, 100, 200, 300, 400, 500, 600, 1000, 1100, 1200, 2000,
			])
		})
	})
})
