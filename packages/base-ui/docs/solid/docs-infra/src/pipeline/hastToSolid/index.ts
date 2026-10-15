// Renders a HAST tree as Solid elements, where JSX places the result: each element is created inside
// its parent's children, so the tree takes its parent's hydration keys on the server and the
// client alike. Properties map as `hast-util-to-jsx-runtime` maps them with HTML attribute names.
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Element as HastElement, Nodes as HastNodes, Parents as HastParents } from 'hast';
import { whitespace } from 'hast-util-whitespace';
import { find, html, svg } from 'property-information';
import type { Schema } from 'property-information';
import { stringify as commas } from 'comma-separated-tokens';
import { stringify as spaces } from 'space-separated-tokens';
import { jsx } from 'docs/src/adapters/jsx-runtime';

/** Components that render elements by tag name (`pre`, `code`, `TypeRef`). */
export type HastComponents = Partial<Record<string, Component<any> | string>>;

// Whitespace text is not valid content of these elements.
const tableElements = new Set(['table', 'tbody', 'thead', 'tfoot', 'tr']);

/** An element's HAST properties as Solid props, with HTML attribute names. */
export function hastPropsToSolidProps(
  properties: HastElement['properties'] = {},
  schema: Schema = html,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [property, raw] of Object.entries(properties)) {
    if (raw == null || (typeof raw === 'number' && Number.isNaN(raw))) {
      continue;
    }
    const info = find(schema, property);
    let value: unknown = raw;
    if (Array.isArray(raw)) {
      value = info.commaSeparated ? commas(raw) : spaces(raw);
    }
    props[info.attribute] = value;
  }
  return props;
}

function renderChildren(node: HastParents, components: HastComponents, schema: Schema) {
  let children = node.children;
  if (node.type === 'element' && tableElements.has(node.tagName)) {
    children = children.filter((child) => !(child.type === 'text' && whitespace(child)));
  }
  const rendered = children.map((child) => renderNode(child, components, schema));
  return rendered.length === 1 ? rendered[0] : rendered;
}

function renderNode(node: HastNodes, components: HastComponents, schema: Schema): JSX.Element {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'root':
      return renderChildren(node, components, schema) as JSX.Element;
    case 'element': {
      const elementSchema = schema.space === 'html' && node.tagName.toLowerCase() === 'svg' ? svg : schema;
      const props = hastPropsToSolidProps(node.properties, elementSchema);
      if (node.children.length > 0) {
        // Read where the element inserts its children, so they are created inside it.
        Object.defineProperty(props, 'children', {
          enumerable: true,
          get: () => renderChildren(node, components, elementSchema),
        });
      }
      return jsx(components[node.tagName] ?? node.tagName, props);
    }
    default:
      // Comments, doctypes and raw HTML render nothing, as with `hast-util-to-jsx-runtime`.
      return null;
  }
}

/**
 * Renders a HAST tree. Call it where JSX places the result (a component's body, a JSX hole or an
 * `element()` thunk), never in a memo whose value is placed elsewhere.
 */
export function renderHast(node: HastNodes, components: HastComponents = {}): JSX.Element {
  return renderNode(node, components, html);
}
