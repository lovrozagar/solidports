import { configure } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { afterEach } from "vitest";

/* Solid 2 batches writes on a microtask; flush after each fired event so assertions see the DOM update. */
configure({
	eventWrapper: (cb) => {
		const result = cb();
		flush();
		return result;
	},
});

/* Solid dev diagnostics (STRICT_READ_UNTRACKED, REACTIVE_WRITE_IN_OWNED_SCOPE, ...) are bugs here: fail the test. */
const diagnostics: Array<string> = [];
for (const method of ["warn", "error"] as const) {
	const original = console[method];
	console[method] = (...args: Array<unknown>) => {
		diagnostics.push(args.map(String).join(" "));
		original(...args);
	};
}

afterEach(() => {
	const found = diagnostics.splice(0);
	if (found.length) throw new Error(`Console diagnostics:\n${found.join("\n")}`);
});
