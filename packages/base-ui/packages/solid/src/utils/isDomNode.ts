/**
 * Whether a value is a DOM node. Never on the server, where `Node` is not defined: a render
 * config object there is told apart without reaching for the DOM.
 */
export function isDomNode(value: unknown): value is Node {
  return typeof Node !== 'undefined' && value instanceof Node;
}
