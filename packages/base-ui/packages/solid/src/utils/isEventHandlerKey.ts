/**
 * Whether a prop key names an event handler: `on` and an uppercase letter (`onClick`), as React's
 * and Solid 2's. A lowercase `onclick` is an attribute in Solid 2.
 */
export function isEventHandlerKey(key: string): boolean {
  const code = key.charCodeAt(2);
  return key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && code >= 65 && code <= 90;
}
