import { hydrate } from "@solidjs/web";
import { flush } from "solid-js";
import { afterEach, describe, expect, it } from "vitest";
import { HeaderTemplateFixture } from "./header-template.fixture";
import { serverRender } from "./serverRender";

/* Server HTML hydrated in jsdom must stay claimed: a table that wrote a signal while it was
   constructed re-rendered right after hydration, replacing the server's nodes with fresh ones (a
   data table's header controls stopped responding). The setup file fails the test on any
   diagnostic, such as the server's SERVER_WRITE. */
let dispose: (() => void) | undefined;
afterEach(() => {
	dispose?.();
	document.body.innerHTML = "";
});

describe("hydrating a table", () => {
	it("keeps the server's nodes for a component header template", async () => {
		const container = document.createElement("div");
		container.innerHTML = await serverRender("header-template.server.tsx");
		document.body.append(container);
		const serverProbe = container.querySelector("[data-probe]");
		(window as unknown as { _$HY: object })._$HY = {
			completed: new WeakSet(),
			done: false,
			events: [],
			fe() {},
			r: {},
		};
		dispose = hydrate(() => <HeaderTemplateFixture />, container);
		flush();
		expect(serverProbe).not.toBeNull();
		expect(container.querySelector("[data-probe]")).toBe(serverProbe);
	}, 60_000);
});
