import { render, screen } from "../helper/render"
import { flush } from "solid-js"
import { vi } from "vitest"
import { Surface, Text } from "../../src"
import { mockGetBoundingClientRect } from "../helper/mockGetBoundingClientRect"
import { getWordsByLines } from "../../src/component/Text"
import * as DOMUtils from "../../src/util/DOMUtils"
import { assertNotNull } from "../helper/assertNotNull"

describe("<Text />", () => {
	const mockRect = {
		height: 17,
		width: 25,
	}
	beforeEach(() => mockGetBoundingClientRect(mockRect))

	test("Does not wrap long text if enough width", () => {
		render(() => (
			<Surface width={300} height={300}>
				<Text role="img" width={300} style={{ "font-family": "Courier" }}>
					This is really long text
				</Text>
			</Surface>
		))

		const text = screen.getByRole("img")
		expect(text).toBeInTheDocument()

		expect(text?.children).toHaveLength(1)
	})

	test("renders number children", () => {
		const { container } = render(() => (
			<Surface width={300} height={300}>
				<Text width={300} style={{ "font-family": "Courier" }}>
					{12345}
				</Text>
			</Surface>
		))

		const text = container.querySelector("text")
		assertNotNull(text)
		expect(text).toBeInTheDocument()

		expect(text.textContent).toBe("12345")
	})

	test("renders boolean children", () => {
		const { container } = render(() => (
			<Surface width={300} height={300}>
				<Text width={300} style={{ "font-family": "Courier" }}>
					{true}
				</Text>
			</Surface>
		))

		const text = container.querySelector("text")
		assertNotNull(text)
		expect(text).toBeInTheDocument()
		expect(text.textContent).toBe("true")
	})

	test('renders the string "NaN" when children is NaN', () => {
		const { container } = render(() => (
			<Surface width={300} height={300}>
				<Text width={300} style={{ "font-family": "Courier" }}>
					{NaN}
				</Text>
			</Surface>
		))

		const text = container.querySelector("text")
		assertNotNull(text)
		expect(text).toBeInTheDocument()
		expect(text.textContent).toBe("NaN")
	})

	test.each([null, undefined] as const)(
		"Renders nothing when children is %s",
		(children: null | undefined) => {
			const { container } = render(() => (
				<Surface width={300} height={300}>
					<Text width={300} style={{ "font-family": "Courier" }}>
						{children}
					</Text>
				</Surface>
			))

			const text = container.querySelector("text")
			expect(text).not.toBeInTheDocument()
		},
	)

	test("renders object object when children are React elements", () => {
		const { container } = render(() => (
			<Surface width={300} height={300}>
				{/* @ts-expect-error typescript is correct here, Text doesn't accept JSX.Element, the test is to demonstrate that */}
				<Text width={300} style={{ "font-family": "Courier" }}>
					<tspan x="0" dy="1.2em">
						Hello
					</tspan>
					<tspan x="0" dy="1.2em">
						World
					</tspan>
				</Text>
			</Surface>
		))

		const text = container.querySelector("text")
		assertNotNull(text)
		expect(text).toBeInTheDocument()
		/* elements are stringified, like upstream's "[object Object],[object Object]" */
		expect(text.textContent).toBe("[object SVGElement],[object SVGElement]")
	})

	test("Wraps long text if not enough width", () => {
		render(() => (
			<Surface width={200} height={200}>
				<Text role="img" width={200} style={{ "font-family": "Courier" }}>
					This is really long text for 200px
				</Text>
			</Surface>
		))
		const text = screen.getByRole("img")
		expect(text).toBeInTheDocument()

		expect(text?.children).toHaveLength(2)
	})

	test("Wraps long text if styled but would have had enough room", () => {
		mockGetBoundingClientRect({ ...mockRect, width: 40 })
		render(() => (
			<Surface width={300} height={200}>
				<Text role="img" width={300} style={{ "font-family": "Courier", "font-size": "2em" }}>
					This is really long text
				</Text>
			</Surface>
		))

		const text = screen.getByRole("img")
		expect(text).toBeInTheDocument()

		expect(text?.children).toHaveLength(2)
	})

	test("Does not perform word length calculation if width or scaleToFit props not set", () => {
		render(() => (
			<Surface width={300} height={200}>
				<Text role="img">This is really long text</Text>
			</Surface>
		))

		const text = screen.getByRole("img")
		expect(text).toBeInTheDocument()

		expect(text?.children).toHaveLength(1)
		// we know that the children that get rendered under `text` are `tspan` - this is a safe cast if we get a result
		const { transform } = (text?.children[0] as SVGTSpanElement).attributes as NamedNodeMap & {
			transform: unknown
		}
		expect(transform).toBeUndefined()
	})

	test("Render 0 successfully when width is specified", () => {
		render(() => (
			<Surface width={300} height={200}>
				<Text role="img" x={0} y={0} width={30}>
					{0}
				</Text>
			</Surface>
		))

		const text = screen.getByRole("img")
		expect(text).toBeInTheDocument()

		setTimeout(() => {
			expect(text.textContent).toContain("0")
		}, 1000)

		flush()
	})

	test("Render 0 successfully when width is not specified", () => {
		render(() => (
			<Surface width={300} height={200}>
				<Text role="img" x={0} y={0}>
					{0}
				</Text>
			</Surface>
		))

		const text = screen.getByRole("img")
		expect(text).toBeInTheDocument()

		setTimeout(() => {
			expect(text.textContent).toContain("0")
		}, 1000)

		flush()
	})

	test("Renders nothing when x or y is a percentage", () => {
		render(() => (
			<Surface width={300} height={200}>
				<Text role="img" x="50%" y="50%">
					anything
				</Text>
			</Surface>
		))

		const text = screen.queryByRole("img")
		expect(text).not.toBeInTheDocument()
	})

	test("Don't Render text when x or y is NaN", () => {
		render(() => (
			<Surface width={300} height={200}>
				<Text role="img" x={NaN} y={10}>
					anything
				</Text>
			</Surface>
		))

		const text = screen.queryByRole("img")
		expect(text).not.toBeInTheDocument()
	})

	test("Only split contents on breaking spaces", () => {
		const testString = "These spaces\tshould\nbreak,\rbut\xA0these\xA0should\xA0not."
		render(() => (
			<Surface width={300} height={200}>
				<Text role="img" width="auto">
					{testString}
				</Text>
			</Surface>
		))

		const text = screen.getByRole("img")
		expect(text).toBeInTheDocument()

		expect(text?.children).toHaveLength(5)
	})

	describe("maxLines", () => {
		test("does not do anything when maxLines are not exceeded", () => {
			render(() => (
				<Surface width={300} height={200}>
					<Text role="img" width={500} maxLines={3}>
						test
					</Text>
				</Surface>
			))
			render(() => (
				<Surface width={300} height={200}>
					<Text role="img" width={500}>
						test
					</Text>
				</Surface>
			))

			const text = screen.getAllByRole("img")
			expect(text[0]).toBeInTheDocument()

			expect(text[0]?.textContent).toEqual(text[1]?.textContent)
		})

		test("limits the output to maxLines", () => {
			const testString = `Lorem ratione omnis fuga dignissimos in amet. Minus quam architecto non ea iste!
        Nihil amet in itaque error velit. Corporis autem sequi aut temporibus placeat.
        Perferendis quos veritatis quasi pariatur!`
			render(() => (
				<Surface width={300} height={200}>
					<Text role="img" width={200} maxLines={2}>
						{testString}
					</Text>
				</Surface>
			))

			const text = screen.getByRole("img")
			expect(text).toBeInTheDocument()

			expect(text?.children).toHaveLength(2)
		})

		test("adds an ellipsis at the end of the truncated line", () => {
			const testString = `Sit totam suscipit aliquid suscipit eius, cupiditate Aut excepturi ipsum ut suscipit
        facilis debitis Provident impedit a distinctio neque quaerat Optio quo quibusdam possimus
        provident accusantium. Molestiae similique nemo labore`
			render(() => (
				<Surface width={300} height={200}>
					<Text role="img" width={200} maxLines={2}>
						{testString}
					</Text>
				</Surface>
			))

			const text = screen.getByRole("img")
			expect(text).toBeInTheDocument()
			const lastChild = text.children[text.children.length - 1]
			const lastLetter = lastChild.textContent[lastChild.textContent.length - 1]

			expect(lastLetter).toEqual("…")
		})
	})
})

describe("getWordsByLines", () => {
	function mockGetStringSize(mockedWidths: Record<string, number | undefined>) {
		vi.spyOn(DOMUtils, "getStringSize").mockImplementation((text) => {
			const width = mockedWidths[text]

			if (width == null) {
				throw new Error(`Missing mock width for text "${text}"`)
			}

			return { height: 0, width }
		})
	}

	beforeEach(() => {
		mockGetStringSize({
			M: 2,
			Ma: 4,
			Mar: 6,
			Marc: 8,
			March: 10,
			"Marc…": 11,
			"Mar…": 9,
			"Ma…": 7,
			"M…": 5,
			"\u00A0": 1,
		})
	})

	it("returns the original text if it does not overflow", () => {
		const wordsByLines = getWordsByLines({
			breakAll: false,
			children: "March",
			maxLines: 1,
			scaleToFit: false,
			width: 11,
		})

		expect(wordsByLines).toEqual([{ width: 10, words: ["March"] }])
	})

	it("returns the original text if it does not overflow and an additional character is narrower than the suffix", () => {
		const wordsByLines = getWordsByLines({
			breakAll: false,
			children: "March",
			maxLines: 1,
			scaleToFit: false,
			width: 10,
		})

		expect(wordsByLines).toEqual([{ width: 10, words: ["March"] }])
	})

	it("truncates the text if it overflows and find the largest string with ellipsis that fits", () => {
		const wordsByLines = getWordsByLines({
			breakAll: false,
			children: "March",
			maxLines: 1,
			scaleToFit: false,
			width: 7,
		})

		expect(wordsByLines).toEqual([{ width: 7, words: ["Ma…"] }])
	})
})

describe("scaleToFit=true", () => {
	beforeEach(() => {
		mockGetBoundingClientRect({ height: 20, width: 50 })
	})

	it("scales text to fit the width", () => {
		const { container } = render(() => (
			<Surface width={300} height={300}>
				<Text width={200} scaleToFit>
					This is really long text
				</Text>
			</Surface>
		))

		const text = container.querySelector("text")
		assertNotNull(text)
		expect(text).toBeInTheDocument()
		expect(text).toHaveAttribute("transform", "scale(0.5714285714285714)")
	})

	it("does not scale text to fit if width is not provided", () => {
		const { container } = render(() => (
			<Surface width={300} height={200}>
				<Text scaleToFit>This is really long text</Text>
			</Surface>
		))

		const text = container.querySelector("text")
		assertNotNull(text)
		expect(text).toBeInTheDocument()
		expect(text).toHaveAttribute("transform", "scale(1)")
	})

	it("should not throw errors if no children are provided", () => {
		// https://github.com/recharts/recharts/issues/6190
		const { container } = render(() => (
			<Surface width={300} height={200}>
				<Text width={200} scaleToFit />
			</Surface>
		))

		const text = container.querySelector("text")
		expect(text).not.toBeInTheDocument()
	})
})
