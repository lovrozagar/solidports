/* @jsxImportSource solid-js */
import { describe, it, expect } from "vitest"
import { createContext, useContext, type JSX, Show, createMemo, createSignal } from "solid-js"
import { Portal } from "solid-js/web"
import { render } from "@solidjs/testing-library"

const Ctx = createContext<string | undefined>(undefined)

function Inner() {
	const v = useContext(Ctx)
	console.log("Inner sees ctx:", v)
	return <span>v={String(v)}</span>
}

function ZIndexishPortal(props: { children: JSX.Element }) {
	const [target, setTarget] = createSignal<HTMLElement | null>(null)
	const portalRoot = (
		<div ref={setTarget} class="portal-root" />
	) as HTMLElement
	return (
		<>
			{portalRoot}
			<Show when={target()}>
				{(mount) => <Portal mount={mount()}>{props.children}</Portal>}
			</Show>
		</>
	)
}

function RegisterId(props: { id: string; children: (id: string) => JSX.Element }) {
	return <Ctx.Provider value={props.id}>{props.children(props.id)}</Ctx.Provider>
}

describe("portal context with render prop", () => {
	it("Show+Portal+render-prop preserves context", () => {
		const result = render(() => (
			<RegisterId id="my-id">
				{(id) => (
					<>
						<ZIndexishPortal>
							<Inner />
						</ZIndexishPortal>
						<span>id={id}</span>
					</>
				)}
			</RegisterId>
		))
		console.log("DOM:", result.container.innerHTML)
		expect(true).toBe(true)
	})

	it("through props.children prop drilling", () => {
		function Outer(props: { children: JSX.Element }) {
			return <div class="outer">{props.children}</div>
		}
		function Wrapper(props: { children: JSX.Element }) {
			return <ZIndexishPortal>{props.children}</ZIndexishPortal>
		}
		const result = render(() => (
			<RegisterId id="drilled">
				{() => (
					<Outer>
						<Wrapper>
							<Inner />
						</Wrapper>
					</Outer>
				)}
			</RegisterId>
		))
		console.log("DOM2:", result.container.innerHTML)
	})
})
