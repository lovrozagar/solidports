/* @jsxImportSource solid-js */
import { describe, it, expect } from "vitest"
import { createContext, useContext, type JSX } from "solid-js"
import { render } from "@solidjs/testing-library"

const Ctx = createContext<string | undefined>(undefined)

const log: string[] = []

function Inner() {
	const v = useContext(Ctx)
	log.push(`Inner setup ctx=${String(v)}`)
	return <span>v={String(v)}</span>
}

function RegisterId(props: { id: string; children: (id: string) => JSX.Element }) {
	log.push(`RegisterId setup id=${props.id}`)
	return <Ctx.Provider value={props.id}>{props.children(props.id)}</Ctx.Provider>
}

function Bar(props: { id: string; children?: JSX.Element }) {
	log.push(`Bar setup`)
	return (
		<RegisterId id={props.id}>
			{(id) => (
				<>
					<span>bar-id={id}</span>
					{props.children}
				</>
			)}
		</RegisterId>
	)
}

describe("eager children trap", () => {
	it("Bar with Inner child", () => {
		log.length = 0
		render(() => (
			<Bar id="bar-1">
				<Inner />
			</Bar>
		))
		console.log("LOG:", log)
		expect(true).toBe(true)
	})
})
