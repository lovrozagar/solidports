// `hast-util-to-jsx-runtime` for the Solid docs. Its default casing is React's (`className`,
// camelCase style keys); Solid takes HTML attribute names and CSS property names. Its component
// types are React's: here they are Solid's.
import { toJsxRuntime as toJsxRuntimeBase } from 'hast-util-to-jsx-runtime';
import type { Options as BaseOptions } from 'hast-util-to-jsx-runtime';
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';

export type Components = Partial<Record<string, Component<any> | string>>;

export type Options = Omit<BaseOptions, 'components'> & { components?: Components };

export function toJsxRuntime(
  tree: Parameters<typeof toJsxRuntimeBase>[0],
  options: Options,
): JSX.Element {
  return toJsxRuntimeBase(tree, {
    ...options,
    elementAttributeNameCase: 'html',
    stylePropertyNameCase: 'css',
  } as BaseOptions) as unknown as JSX.Element;
}
