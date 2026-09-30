/**
 * Creates a proxy around a native DOM event that preserves the currentTarget
 * at the time of creation, since currentTarget is nullified after the event
 * finishes propagating in native DOM events.
 */
export function createEventProxy<T extends Event>(event: T): T {
	const { currentTarget } = event
	return new Proxy(event, {
		get: (target, prop) => {
			if (prop === "currentTarget") {
				return currentTarget
			}
			const value = Reflect.get(target, prop)
			if (typeof value === "function") {
				return value.bind(target)
			}
			return value
		},
	})
}
