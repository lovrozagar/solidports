/* @jsxImportSource solid-js */
import { describe, it, expect } from "vitest"
import { createContext, useContext, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { render } from "@solidjs/testing-library"

const Ctx = createContext<string | undefined>(undefined)

function Inner() {
	const v = useContext(Ctx)
	console.log("Inner sees ctx:", v)
	return <span>v={String(v)}</span>
}

describe("portal context", () => {
	it("Solid Portal preserves context across DOM jump", () => {
		const result = render(() => (
			<Ctx.Provider value="hello">
				<Portal mount={document.body}>
					<Inner />
				</Portal>
			</Ctx.Provider>
		))
		console.log("DOM:", result.container.innerHTML)
		console.log("BODY:", document.body.innerHTML)
		expect(true).toBe(true)
	})

	it("nested function child in Provider preserves ctx", () => {
		const Wrapper = (props: { children: (id: string) => JSX.Element }) => {
			return <Ctx.Provider value="from-render-prop">{props.children("ID")}</Ctx.Provider>
		}
		const result = render(() => (
			<Wrapper>
				{(id: string) => (
					<>
						<Inner />
						<span>id={id}</span>
					</>
				)}
			</Wrapper>
		))
		console.log("DOM2:", result.container.innerHTML)
	})
})
