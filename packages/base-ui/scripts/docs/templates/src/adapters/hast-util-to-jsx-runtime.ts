// `hast-util-to-jsx-runtime` for the Solid docs. Its default casing is React's (`className`,
// camelCase style keys); Solid takes HTML attribute names and CSS property names.
import { toJsxRuntime as toJsxRuntimeBase } from 'hast-util-to-jsx-runtime';
import type { Options } from 'hast-util-to-jsx-runtime';

export type * from 'hast-util-to-jsx-runtime';

export function toJsxRuntime(tree: Parameters<typeof toJsxRuntimeBase>[0], options: Options) {
  return toJsxRuntimeBase(tree, {
    ...options,
    elementAttributeNameCase: 'html',
    stylePropertyNameCase: 'css',
  } as Options);
}
