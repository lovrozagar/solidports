// `mdx/types` for the Solid docs: MDX's component types, with Solid components (the package types
// React's). `MDXComponents` is the components by name that `hast-util-to-jsx-runtime` takes too.
import type { Component } from 'solid-js';

/** The components MDX content renders its elements with, by name. */
export type MDXComponents = Partial<Record<string, Component<any> | string>>;

/** The props of MDX content. */
export interface MDXProps {
  components?: MDXComponents | undefined;
  [key: string]: unknown;
}

/** MDX content, as a component. */
export type MDXContent = Component<MDXProps>;

/** A compiled MDX module. */
export interface MDXModule {
  default: MDXContent;
  [key: string]: unknown;
}
