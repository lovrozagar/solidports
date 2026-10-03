/*
 * Structural copies of the d3-shape types that appear in the public API (from @types/d3-shape
 * and @types/d3-path, MIT). The runtime curves and symbols are bundled from victory-vendor, so
 * the published declarations must not import its types; d3's own factories stay assignable.
 */

/** A d3-path path serializer (d3-path `Path`). */
export interface D3Path {
	moveTo(x: number, y: number): void
	closePath(): void
	lineTo(x: number, y: number): void
	quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void
	bezierCurveTo(cpx1: number, cpy1: number, cpx2: number, cpy2: number, x: number, y: number): void
	arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void
	arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void
	rect(x: number, y: number, w: number, h: number): void
	toString(): string
}

/** The subset of CanvasRenderingContext2D a d3 symbol draws to (d3-shape `CanvasPath_D3Shape`). */
export interface CanvasPath_D3Shape {
	arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void
	arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void
	bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void
	closePath(): void
	ellipse(
		x: number,
		y: number,
		radiusX: number,
		radiusY: number,
		rotation: number,
		startAngle: number,
		endAngle: number,
		anticlockwise?: boolean,
	): void
	lineTo(x: number, y: number): void
	moveTo(x: number, y: number): void
	quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void
	rect(x: number, y: number, w: number, h: number): void
}

/** d3-shape `CurveGenerator`. */
export interface CurveGenerator {
	lineStart(): void
	lineEnd(): void
	point(x: number, y: number): void
	areaStart(): void
	areaEnd(): void
}

/** d3-shape `CurveFactory`. */
export type CurveFactory = (context: CanvasRenderingContext2D | D3Path) => CurveGenerator

/** d3-shape `SymbolType`. */
export interface D3SymbolType {
	draw(context: CanvasPath_D3Shape, size: number): void
}
