import { createEffect, createSignal } from "solid-js"
import type { Accessor } from "solid-js"

type FirstDependencies = Record<string, unknown>
type ChangedDependencies = Record<string, { after: unknown; before: unknown }>

/**
 * Debug helper that logs which tracked dependencies changed between
 * effect runs. Solid equivalent of the React useEffectDebug hook.
 *
 * Because Solid tracks dependencies automatically via signal reads,
 * the caller must pass explicit dependency accessors so the debugger
 * can compare previous vs current values.
 */
export function useEffectDebug(
	debuggerName: string,
	effectFn: () => void,
	dependencies: ReadonlyArray<Accessor<unknown>>,
	dependencyNames: string[] = [],
): void {
	const [getPrev, setPrev] = createSignal<ReadonlyArray<unknown> | null>(null)

	createEffect(() => {
		const currentValues = dependencies.map((dep) => dep())
		const previousValues = getPrev()

		if (previousValues === null) {
			const firstDeps: FirstDependencies = currentValues.reduce<FirstDependencies>(
				(accum, dep, index) => {
					const keyName = dependencyNames[index] ?? String(index)
					return { ...accum, [keyName]: dep }
				},
				{},
			)
			console.log("[use-effect-debugger]", debuggerName, "initial render", firstDeps)
		} else {
			const changedDeps: ChangedDependencies = currentValues.reduce<ChangedDependencies>(
				(accum, dep, index) => {
					if (dep !== previousValues[index]) {
						const keyName = dependencyNames[index] ?? String(index)
						return {
							...accum,
							[keyName]: {
								after: dep,
								before: previousValues[index],
							},
						}
					}
					return accum
				},
				{},
			)

			const changedKeys = Object.keys(changedDeps)

			if (changedKeys.length) {
				const prev = Object.fromEntries(
					changedKeys.map((key) => {
						if (key in changedDeps) {
							return [key, changedDeps[key].before]
						}
						return [key, undefined]
					}),
				)
				const curr = Object.fromEntries(changedKeys.map((key) => [key, changedDeps[key].after]))
				console.log("[use-effect-debugger]", debuggerName, changedKeys.join(", "), { curr, prev })
			}
		}

		setPrev(currentValues)
		effectFn()
	})
}
