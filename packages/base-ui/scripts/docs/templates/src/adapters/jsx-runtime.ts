// `react/jsx-runtime` for the Solid docs: the `jsx` calls code builds elements with at runtime (MDX
// content, `hast-util-to-jsx-runtime`). A tag name renders through a static `dynamic` element:
// created directly with no memo per element, so a long list of children (highlighted code tokens)
// does not make its parent track every child.
import { createComponent } from 'solid-js';
import type { Component } from 'solid-js';
import { dynamic } from '@solidjs/web';
import type { JSX } from '@solidjs/web';

type Props = Record<string, unknown>;

const staticTags = new Map<string, Component<Props>>();

function staticTag(tag: string) {
  let component = staticTags.get(tag);
  if (!component) {
    component = dynamic(() => tag, { static: true }) as Component<Props>;
    staticTags.set(tag, component);
  }
  return component;
}

export function jsx(type: unknown, props: Props): JSX.Element {
  if (typeof type === 'function') {
    return createComponent(type as Component<Props>, props);
  }
  return createComponent(staticTag(typeof type === 'string' ? type : 'span'), props);
}

export { jsx as jsxs, jsx as jsxDEV };

export function Fragment(props: { children?: JSX.Element }): JSX.Element {
  // The children getter returns what the renderer inserts (a dynamic child is a memo), as Solid's
  // own fragments return it.
  // eslint-disable-next-line solid/reactivity
  return props.children;
}
