/* @jsxImportSource solid-js */
import { describe, it, expect } from "vitest"
import { createContext, useContext, type JSX } from "solid-js"
import { render } from "@solidjs/testing-library"

const Ctx = createContext<string | undefined>(undefined)

const log: string[] = []

function Outer(props: { children: JSX.Element }) {
	log.push("Outer body")
	return <Ctx.Provider value="from-outer">{props.children}</Ctx.Provider>
}

function Inner() {
	const v = useContext(Ctx)
	log.push(`Inner body, ctx=${String(v)}`)
	return null
}

describe("eval order", () => {
	it("trace which runs first", () => {
		log.length = 0
		render(() => (
			<Outer>
				<Inner />
			</Outer>
		))
		console.log("LOG:", log)
		expect(true).toBe(true)
	})
})
