import { createEffect } from "solid-js"
import { render } from "@solidjs/testing-library"
import { describe, it, expect } from "vitest"
import type { JSX } from "solid-js"
import {
  ChartSelectorsProvider,
  createChartSelectors,
  useChartSelectors,
} from "../../../src/state/hooks/useChartSelectors"
import { createStore } from "solid-js/store"
import { createInitialState } from "../../../src/state/store"

function withProvider(store: ReturnType<typeof createStore>[0], children: () => JSX.Element): JSX.Element {
  const chartSelectors = createChartSelectors(store)
  return (
    <ChartSelectorsProvider value={chartSelectors}>
      {children()}
    </ChartSelectorsProvider>
  )
}

describe("debug-fn-children", () => {
  it("fn children resolves inside provider", () => {
    const [store] = createStore(createInitialState())
    let got: ReturnType<typeof useChartSelectors> | undefined

    const Probe = (): null => {
      createEffect(() => {
        got = useChartSelectors()
      })
      return null
    }

    render(() => withProvider(store, () => <Probe />))

    expect(got).not.toBeUndefined()
  })
})
