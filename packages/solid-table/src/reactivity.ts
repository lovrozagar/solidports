import { createEffect, createMemo, createRoot, createSignal, runWithOwner, untrack } from "solid-js";
import type { Atom, Observer, ReadonlyAtom, Subscription } from "@tanstack/store";
import type { TableAtomOptions, TableReactivityBindings } from "@tanstack/table-core/reactivity";
import type { Accessor, Owner } from "solid-js";

type ObserverOrNext<T> = Observer<T> | ((value: T) => void);

/**
 * Pushes changes of `source` to a Store-style observer. Mirrors TanStack Store:
 * no emission on subscribe, only on later changes. The effect lives in its own
 * root under the table owner so each subscription disposes independently.
 */
function subscribeToSignal<T>(source: Accessor<T>, owner: Owner | null, observer: ObserverOrNext<T>): Subscription {
	const next = typeof observer === "function" ? observer : observer.next?.bind(observer);
	let dispose: () => void = () => {};

	runWithOwner(owner, () =>
		createRoot((rootDispose) => {
			dispose = rootDispose;
			createEffect(
				source,
				(value) => {
					/* Store observers read atoms freely; keep those reads out of Solid's strict-read checks. */
					untrack(() => next?.(value));
				},
				{ defer: true },
			);
		}),
	);

	return { unsubscribe: () => dispose() };
}

function signalToReadonlyAtom<T>(signal: Accessor<T>, owner: Owner | null): ReadonlyAtom<T> {
	return Object.assign(signal, {
		get: () => signal(),
		subscribe: (observer: ObserverOrNext<T>) => subscribeToSignal(signal, owner, observer),
	}) as unknown as ReadonlyAtom<T>;
}

function signalToWritableAtom<T>(
	signal: Accessor<T>,
	setSignal: (updater: (prev: T) => T) => void,
	owner: Owner | null,
): Atom<T> {
	return Object.assign(signal, {
		/* Always route through the updater form: a function-valued slice must be stored, not invoked. */
		set: (updater: T | ((prev: T) => T)) => {
			setSignal(typeof updater === "function" ? (updater as (prev: T) => T) : () => updater);
		},
		get: () => signal(),
		subscribe: (observer: ObserverOrNext<T>) => subscribeToSignal(signal, owner, observer),
	}) as unknown as Atom<T>;
}

const BASE_ATOM_PREFIX = "table/baseAtoms/";
const OPTIONS_STORE = "table/optionsStore";

export interface SolidReactivityOptions {
	/** The options store's initial value from the options table-core constructed. */
	seedOptions?: (constructed: object) => object;
}

/**
 * Creates the table-core reactivity bindings used by the Solid adapter.
 *
 * Table state atoms are Solid signals and memos, so table APIs participate in
 * Solid dependency tracking. Solid 2 already batches writes on a microtask, so
 * `batch` only runs the callback. Writable atoms opt into owned writes because
 * table-core syncs controlled state while the table is being constructed.
 *
 * Base state atoms are writable derived signals over `getControlledState()[key]`:
 * they follow controlled state in the same flush and keep the last controlled
 * value when control is released, while table writes still override them.
 */
export function solidReactivity(
	owner: Owner | null,
	getControlledState?: () => Record<string, unknown> | undefined,
	reactivityOptions: SolidReactivityOptions = {},
): TableReactivityBindings {
	const subscriptions = new Set<Subscription>();

	return {
		createOptionsStore: true,
		wrapExternalAtoms: true,
		addSubscription: (subscription) => {
			subscriptions.add(subscription);
		},
		unmount: () => {
			subscriptions.forEach((s) => s.unsubscribe());
			subscriptions.clear();
		},
		schedule: (fn) => queueMicrotask(() => fn()),
		createReadonlyAtom: <T>(fn: () => T, options?: TableAtomOptions<T>) => {
			const memo = runWithOwner(owner, () =>
				createMemo(() => fn(), { equals: options?.compare, name: options?.debugName }),
			);
			return signalToReadonlyAtom(memo, owner);
		},
		createWritableAtom: <T>(initial: T, options?: TableAtomOptions<T>): Atom<T> => {
			const value =
				options?.debugName === OPTIONS_STORE && reactivityOptions.seedOptions
					? (reactivityOptions.seedOptions(initial as object) as T)
					: initial;
			const signalOptions = { equals: options?.compare, name: options?.debugName, ownedWrite: true };
			const stateKey = options?.debugName?.startsWith(BASE_ATOM_PREFIX)
				? options.debugName.slice(BASE_ATOM_PREFIX.length)
				: undefined;

			const [signal, setSignal] = runWithOwner(owner, () =>
				stateKey !== undefined && getControlledState
					? createSignal<T>((prev) => {
							const state = getControlledState();
							if (state && Object.hasOwn(state, stateKey)) {
								const controlled = state[stateKey];
								/* table-core treats an undefined controlled slice as the initial state. */
								return (controlled === undefined ? value : controlled) as T;
							}
							return prev === undefined ? value : prev;
						}, signalOptions)
					: /* table-core only stores state slices and the options object, never functions. */
						createSignal<T>(value as Exclude<T, Function>, signalOptions),
			);
			return signalToWritableAtom(signal, setSignal as (updater: (prev: T) => T) => void, owner);
		},
		untrack,
		batch: (fn) => fn(),
	};
}
