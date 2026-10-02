import { createRoot, flush } from "solid-js";

/** Runs `setup` in a root, flushes the initial reactive pass, and hands back the disposer. */
export function createTestRoot<T>(setup: () => T) {
	let dispose!: () => void;
	const value = createRoot((rootDispose) => {
		dispose = rootDispose;
		return setup();
	});
	flush();
	return { dispose, value };
}
