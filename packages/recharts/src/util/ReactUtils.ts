/* eslint-disable import/no-cycle, sort-keys */
import type { Component, JSX } from "solid-js"
import type { ActiveDotType, DotType } from "./types"

export const SCALE_TYPES = [
	"auto",
	"linear",
	"pow",
	"sqrt",
	"log",
	"identity",
	"time",
	"band",
	"point",
	"ordinal",
	"quantile",
	"quantize",
	"utc",
	"sequential",
	"threshold",
]

/**
 * Get the display name of a component.
 * In Solid, components don't have displayName, so we fall back to .name.
 * @param  {Object} Comp Specified Component
 * @return {String}      Display name of Component
 */
export const getDisplayName = (Comp: Component | string) => {
	if (typeof Comp === "string") {
		return Comp
	}
	if (!Comp) {
		return ""
	}
	return Comp.name || "Component"
}

/**
 * In Solid there is no React.Children API. This is a no-op placeholder
 * that returns an empty array. Components should use explicit props patterns
 * instead of child introspection.
 */
export function findAllByType(
	_children: JSX.Element | undefined,
	_type: Component,
): ReadonlyArray<Record<string, unknown>> {
	return []
}

export const isClipDot = (dot: ActiveDotType | DotType): boolean => {
	if (dot && typeof dot === "object" && "clipDot" in dot) {
		return Boolean(dot.clipDot)
	}
	return true
}

/* React `<Foo />` builds a vNode (lazy descriptor) that `cloneElement` can
 * re-instantiate per iteration with merged props. Solid `<Foo />` evaluates
 * eagerly to a live DOM Node — function reference + original props are gone.
 * The closest emulation: detect a Node value and clone it, optionally applying
 * iteration-specific attrs. Spies inside the original component fire ONCE at
 * JSX evaluation; only the rendered DOM count and final attribute values are
 * recoverable. Documented under Cluster C / GOTCHA-016. */
export function isJsxNode(value: unknown): value is Node {
	return value != null && typeof value === "object" && "cloneNode" in value
}

const SVG_CAMEL_TO_KEBAB: Record<string, string> = {
	tabIndex: "tabindex",
	readOnly: "readonly",
	contentEditable: "contenteditable",
	spellCheck: "spellcheck",
	autoFocus: "autofocus",
	clipPath: "clip-path",
	clipRule: "clip-rule",
	fillOpacity: "fill-opacity",
	strokeWidth: "stroke-width",
	strokeOpacity: "stroke-opacity",
	strokeLinecap: "stroke-linecap",
	strokeLinejoin: "stroke-linejoin",
	strokeDasharray: "stroke-dasharray",
	strokeDashoffset: "stroke-dashoffset",
	textAnchor: "text-anchor",
}

function attrNameFor(key: string): string {
	return SVG_CAMEL_TO_KEBAB[key] ?? key
}

/* Apply iteration props onto a fresh clone of a user-supplied JSX Node.
 * Skips function values, undefined, and the "key"/"children"/"className"/"class"
 * meta-props. Booleans serialize as "true"/"false" to match recharts upstream
 * `cloneElement` behaviour where downstream `getAttribute` reads the string. */
export function cloneJsxNodeWithProps(node: Node, props: Record<string, unknown>): Node {
	const cloned = node.cloneNode(true)
	if (!(cloned instanceof Element)) return cloned

	for (const key in props) {
		if (key === "key" || key === "children" || key === "className" || key === "class") continue
		const value = props[key]
		if (value == null || typeof value === "function") continue
		if (typeof value === "object") continue
		cloned.setAttribute(attrNameFor(key), String(value))
	}
	return cloned
}
