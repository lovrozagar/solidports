// DOM input drivers shared by both apps: real event sequences as a browser dispatches them.

export const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

/** Yields to the event loop without the 4 ms timer clamp (a new task, as between user events). */
export const yieldTask = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });

export function q<T extends Element = HTMLElement>(selector: string, root: ParentNode = document) {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`No element for ${selector}`);
  }
  return element;
}

export const qa = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(selector));

function center(element: Element) {
  const rect = element.getBoundingClientRect();
  return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
}

const pointerInit = (element: Element, extra: PointerEventInit = {}): PointerEventInit => ({
  bubbles: true,
  cancelable: true,
  composed: true,
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  button: 0,
  buttons: 1,
  ...center(element),
  ...extra,
});

/** pointerdown → mousedown → (focus) → pointerup → mouseup → click. */
export function click(element: Element) {
  element.dispatchEvent(new PointerEvent('pointerdown', pointerInit(element)));
  element.dispatchEvent(new MouseEvent('mousedown', pointerInit(element)));
  if (element instanceof HTMLElement && element.tabIndex >= 0) {
    element.focus();
  }
  element.dispatchEvent(new PointerEvent('pointerup', pointerInit(element, { buttons: 0 })));
  element.dispatchEvent(new MouseEvent('mouseup', pointerInit(element, { buttons: 0 })));
  element.dispatchEvent(new MouseEvent('click', pointerInit(element, { buttons: 0 })));
}

/** pointerover/enter → mouseover/enter → pointermove → mousemove (a hover arriving at `element`). */
export function hover(element: Element) {
  const init = pointerInit(element, { buttons: 0 });
  element.dispatchEvent(new PointerEvent('pointerover', init));
  element.dispatchEvent(new PointerEvent('pointerenter', { ...init, bubbles: false }));
  element.dispatchEvent(new MouseEvent('mouseover', init));
  element.dispatchEvent(new MouseEvent('mouseenter', { ...init, bubbles: false }));
  element.dispatchEvent(new PointerEvent('pointermove', init));
  element.dispatchEvent(new MouseEvent('mousemove', init));
}

export function unhover(element: Element) {
  const init = pointerInit(element, { buttons: 0 });
  element.dispatchEvent(new PointerEvent('pointerout', init));
  element.dispatchEvent(new PointerEvent('pointerleave', { ...init, bubbles: false }));
  element.dispatchEvent(new MouseEvent('mouseout', init));
  element.dispatchEvent(new MouseEvent('mouseleave', { ...init, bubbles: false }));
}

/** keydown (+ keypress for printable keys) → keyup on the focused element (or `target`). */
export function key(name: string, target: Element = document.activeElement ?? document.body) {
  const init: KeyboardEventInit = { key: name, bubbles: true, cancelable: true, composed: true };
  const allowed = target.dispatchEvent(new KeyboardEvent('keydown', init));
  if (allowed && name.length === 1) {
    target.dispatchEvent(new KeyboardEvent('keypress', init));
  }
  target.dispatchEvent(new KeyboardEvent('keyup', init));
}

const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;

/** Sets an input's value as typing does: native setter + `input` event. */
export function setInputValue(input: HTMLInputElement, value: string) {
  valueSetter.call(input, value);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
}

/** Types `text` one character at a time, yielding a task between characters. */
export async function type(input: HTMLInputElement, text: string, flush: () => void) {
  input.focus();
  for (const char of text) {
    key(char, input);
    setInputValue(input, input.value + char);
    flush();
    await yieldTask();
  }
}

/** A pointer drag from `element`'s center by (dx, dy) in `moves` moves, a task between moves. */
export async function drag(
  element: Element,
  dx: number,
  dy: number,
  moves: number,
  flush: () => void,
  pointerType: 'mouse' | 'touch' = 'mouse',
) {
  const start = center(element);
  element.dispatchEvent(new PointerEvent('pointerdown', pointerInit(element, { pointerType })));
  for (let i = 1; i <= moves; i += 1) {
    const init = pointerInit(element, {
      pointerType,
      clientX: start.clientX + (dx * i) / moves,
      clientY: start.clientY + (dy * i) / moves,
    });
    (pointerType === 'touch' ? element : document).dispatchEvent(new PointerEvent('pointermove', init));
    flush();
    await yieldTask();
  }
  const end = pointerInit(element, {
    pointerType,
    buttons: 0,
    clientX: start.clientX + dx,
    clientY: start.clientY + dy,
  });
  // Dispatched at the element once; it bubbles to document listeners as a real release does.
  element.dispatchEvent(new PointerEvent('pointerup', end));
}

/** Text of the highlighted item, for verify summaries. */
export const highlightedText = () =>
  document.querySelector('[data-highlighted]')?.textContent?.trim() ?? null;

/** A stable summary of an element's open/checked/selected state attributes. */
export function stateOf(element: Element | null) {
  if (!element) {
    return null;
  }
  const names = [
    'aria-expanded',
    'aria-checked',
    'aria-selected',
    'aria-pressed',
    'data-open',
    'data-closed',
    'data-checked',
    'data-unchecked',
    'data-selected',
    'data-highlighted',
    'data-disabled',
  ];
  return Object.fromEntries(
    names.filter((name) => element.hasAttribute(name)).map((name) => [name, element.getAttribute(name)]),
  );
}
