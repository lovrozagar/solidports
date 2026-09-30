import { describe, it, expect } from "vitest"
import { createStore, produce } from "solid-js/store"
import { createMemo, createRoot, createRenderEffect } from "solid-js"

describe("Solid store tracking", () => {
  it("memo+effect re-runs on store array push", () => {
    let runs = 0
    let lastLen = -1
    createRoot(() => {
      const [state, setState] = createStore({ items: [] as number[] })
      const items = createMemo(() => state.items)
      createRenderEffect(() => {
        runs++
        lastLen = items().length
        console.log("EFFECT run", runs, "len=", items().length)
      })
      console.log("before dispatch")
      setState("items", produce((arr: number[]) => { arr.push(1) }))
      console.log("after dispatch")
    })
    expect(runs).toBeGreaterThan(1)
    expect(lastLen).toBe(1)
  })
})
