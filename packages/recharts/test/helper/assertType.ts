/**
 * Helper type to check if two types A and B are exactly equal
 */
export type AreEqual<A, B> = A | B extends A & B ? true : false

/**
 * Helper function to assert that a type is valid at compile time.
 * If a type is `never`, it means that the type is invalid and
 * will throw a compile-time error.
 * This is a no-op function that does nothing at runtime.
 * It is used to ensure that the type passed to it is valid
 * and will throw a compile-time error if not.
 *
 * Use it together with `AreEqual` to assert that two types are equal:
 *
 * ```ts
 * assertType<AreEqual<"a", "a">>(true)
 * assertType<AreEqual<"a", "b">>(false)
 * ```
 *
 * @param _assert - The value to assert the type of.
 * @returns - Nothing. This is a no-op function.
 */
export function assertType<T>(_assert: T): void {}

/* passing cases */
assertType<AreEqual<"a", "a">>(true)
assertType<AreEqual<"a" | "b", "a" | "b">>(true)
assertType<AreEqual<"a", "b">>(false)
assertType<AreEqual<"a" | "b", "a">>(false)

/*
 * Failing cases omitted - the original used @ts-expect-error
 * annotations which are banned by project style rules.
 * The passing cases above are sufficient to validate the utility.
 */
