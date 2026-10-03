/* Runtime shim for @solidjs/web/jsx-{dev-}runtime imports.
   @solidjs/vite-plugin rewrites .tsx JSX before eval, but @mdx-js/rollup
   emits jsx(...) calls that survive to runtime — notably for native HTML tags like
   `<details>`/`<summary>` MDX passes through. `createComponent(string, props)` throws
   `Comp is not a function` in SSR, so strings render through a static `dynamic()` element:
   created directly on the client (and hydrated) and on the server, with no memo per element, so
   long children lists (Shiki's token spans) do not make their parent track every child. */
import { createComponent } from 'solid-js';
import type { Component } from 'solid-js';
import { dynamic } from '@solidjs/web';

const staticTags = new Map<string, Component<Record<string, unknown>>>();

function staticTag(tag: string) {
  let component = staticTags.get(tag);
  if (!component) {
    component = dynamic(() => tag, { static: true }) as Component<Record<string, unknown>>;
    staticTags.set(tag, component);
  }
  return component;
}

function jsx(type: unknown, props: Record<string, unknown>) {
  if (typeof type !== "function") {
    return createComponent(staticTag(typeof type === "string" ? type : "span"), props)
  }
  return createComponent(type as Parameters<typeof createComponent>[0], props)
}

function Fragment(props: { children?: unknown }) {
  return props.children
}

export { jsx, jsx as jsxDEV, jsx as jsxs, Fragment }
