import { render } from "../../helper/render"
import { observe } from "../../helper/observe"
import { describe, it, expect } from "vitest"
import type { JSX } from '@solidjs/web';
import {
  ChartSelectorsProvider,
  createChartSelectors,
  useChartSelectors,
} from "../../../src/state/hooks/useChartSelectors"
import { createInitialState } from "../../../src/state/store"
import { createStore } from '../../../src/util/solid-1-compat';
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
      observe(() => {
        got = useChartSelectors()
      })
      return null
    }

    render(() => withProvider(store, () => <Probe />))

    expect(got).not.toBeUndefined()
  })
})
