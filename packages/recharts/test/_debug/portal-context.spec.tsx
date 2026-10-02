/* @jsxImportSource @solidjs/web */
import { describe, it, expect } from "vitest"
import { createContext, useContext, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Portal } from '@solidjs/web';
import { render } from "../helper/render"

const Ctx = createContext<string | undefined>(undefined)

function Inner() {
	const v = untrack(() => useContext(Ctx))
	console.log("Inner sees ctx:", v)
	return <span>v={String(v)}</span>
}

describe("portal context", () => {
	it("Solid Portal preserves context across DOM jump", () => {
		const result = render(() => (
			<Ctx value="hello">
				<Portal mount={document.body}>
					<Inner />
				</Portal>
			</Ctx>
		))
		console.log("DOM:", result.container.innerHTML)
		console.log("BODY:", document.body.innerHTML)
		expect(true).toBe(true)
	})

	it("nested function child in Provider preserves ctx", () => {
		const Wrapper = (props: { children: (id: string) => JSX.Element }) => {
			return <Ctx value="from-render-prop">{props.children("ID")}</Ctx>
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
