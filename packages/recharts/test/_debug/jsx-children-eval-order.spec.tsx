/* @jsxImportSource @solidjs/web */
import { describe, it, expect } from "vitest"
import { createContext, useContext, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { render } from "../helper/render"

const Ctx = createContext<string | undefined>(undefined)

const log: string[] = []

function Outer(props: { children: JSX.Element }) {
	log.push("Outer body")
	return <Ctx value="from-outer">{props.children}</Ctx>
}

function Inner() {
	const v = untrack(() => useContext(Ctx))
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
