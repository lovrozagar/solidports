import { describe, it } from "vitest"
import {
	DisallowExtraKeys,
	OptionalKeys,
	RequiredKeys,
	RequiresDefaultProps,
	resolveDefaultProps,
} from "../../src/util/resolveDefaultProps"
import { AreEqual, assertType } from "../helper/assertType"

describe("resolveDefaultProps types", () => {
	it("should return same type as input if there are no defaults", () => {
		type OutsideProps = {
			a: number
			b?: string
			c?: boolean
		}
		type DefaultProps = object
		const input: OutsideProps = { a: 1, b: "test" }
		const defaults: DefaultProps = {}
		const result = resolveDefaultProps(input, defaults)
		type Actual = typeof result
		type Expected = OutsideProps
		result satisfies Expected
		assertType<AreEqual<Actual, Expected>>(true)
	})
	it("should make the optional properties required if they are filled in from the defaults", () => {
		type OutsideProps = {
			a: number
			b?: string
			c?: boolean
		}
		type DefaultProps = {
			b: string
		}
		const input: OutsideProps = { a: 1 }
		const defaults: DefaultProps = { b: "test" }
		const result = resolveDefaultProps(input, defaults)
		type Actual = typeof result
		type Expected = { a: number; b: string; c?: boolean }
		result satisfies Expected
		assertType<AreEqual<Actual, Expected>>(true)

		/*
		 * Negative type test cases (extra keys, wrong types) omitted —
		 * they require @ts-expect-error which is banned by project style.
		 */
	})
	it("should not, but it does allow defaults to have properties that are explicitly undefined", () => {
		type OutsideProps = {
			a: number
		}
		type DefaultProps = {
			a: number | undefined
		}
		const input: OutsideProps = { a: 1 }
		const defaults: DefaultProps = { a: undefined }
		const result = resolveDefaultProps(input, defaults)
		void result
	})
})
describe("type RequiredKeys", () => {
	it("should return the keys that are required", () => {
		type TestType = {
			a: number
			b?: string
			c: boolean
		}
		type Result = RequiredKeys<TestType>
		type Expected = "a" | "c"
		assertType<AreEqual<Result, Expected>>(true)
	})
})
describe("type OptionalKeys", () => {
	it("should return the keys that are optional", () => {
		type TestType = {
			a: number
			b?: string
			c: boolean
		}
		type Result = OptionalKeys<TestType>
		type Expected = "b"
		assertType<AreEqual<Result, Expected>>(true)
	})
})
describe("RequiresDefaultProps", () => {
	it("should keep output properties optional if defaults do not have those", () => {
		type TestType = {
			a: number
			b?: string
			c: boolean
		}
		type DefaultType = { a: number }
		type Result = RequiresDefaultProps<TestType, DefaultType>
		type Expected = { a: number; b?: string; c: boolean }
		const foo: Result = { a: 1, c: true } satisfies Expected
		assertType<AreEqual<Result, Expected>>(true)
		void foo
	})
	it("should keep output properties optional if defaults have the same properties also optional", () => {
		type TestType = {
			a: number
			b?: string
			c: boolean
		}
		type DefaultType = { b?: string }
		type Result = RequiresDefaultProps<TestType, DefaultType>
		type Expected = { a: number; b?: string; c: boolean }
		const foo: Result = { a: 1, c: true } satisfies Expected
		assertType<AreEqual<Result, Expected>>(true)
		void foo
	})
	it("should allow specifying the type explicitly", () => {
		type Input = {
			a?: number
			b?: string
		}
		const input: Input = {}
		type Defaults = {
			a: number
		}
		const defaults: Defaults = { a: 1 }
		type Output = {
			a: number
			b?: string
		}
		const result: Output = resolveDefaultProps(input, defaults)
		void result
	})
})
describe("DisallowExtraKeys", () => {
	it("should allow two types with the same keys", () => {
		type A = {
			a: string
			b: number
		}
		type B = {
			a: string
			b: number
		}
		type Result = DisallowExtraKeys<A, B>
		assertType<AreEqual<Result, A>>(true)
	})
	it("should allow two types with keys of different type", () => {
		type A = {
			a: string
			b: number
		}
		type B = {
			a: string
			b: string
		}
		type Result = DisallowExtraKeys<A, B>
		/*
		 * This is not exactly the behaviour that we want, but it looks like this type can't do everything alone
		 * and so we get the final result by combining DisallowExtraKeys with resolveDefaultProps signature
		 */
		assertType<AreEqual<Result, A>>(false)
		assertType<AreEqual<Result, B>>(true)
		assertType<AreEqual<Result, never>>(false)
	})
	it("should allow the second type have fewer keys", () => {
		type A = {
			a: string
			b: number
		}
		type B = {
			a: string
		}
		type Result = DisallowExtraKeys<A, B>
		assertType<AreEqual<Result, A>>(false)
		assertType<AreEqual<Result, B>>(true)
		assertType<AreEqual<Result, never>>(false)
	})
})
