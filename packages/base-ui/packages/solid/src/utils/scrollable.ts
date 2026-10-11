import {
  getComputedStyle,
  getParentNode,
  isElement,
  isHTMLElement,
  isLastTraversableNode,
} from '@floating-ui/utils/dom';

export type ScrollAxis = 'horizontal' | 'vertical';

export function isScrollableY(element: HTMLElement, allowOverflowIntent = false): boolean {
  const { overflowY } = getComputedStyle(element);
  if (overflowY !== 'auto' && overflowY !== 'scroll') {
    return false;
  }
  // When `allowOverflowIntent` is true, a container that overflows only once extra space is
  // added (e.g. drawer keyboard scroll slack) still counts, as long as it has layout size on
  // the axis.
  return allowOverflowIntent
    ? element.clientHeight > 0
    : element.scrollHeight > element.clientHeight;
}

export function isScrollableX(element: HTMLElement, allowOverflowIntent = false): boolean {
  const { overflowX } = getComputedStyle(element);
  if (overflowX !== 'auto' && overflowX !== 'scroll') {
    return false;
  }
  return allowOverflowIntent ? element.clientWidth > 0 : element.scrollWidth > element.clientWidth;
}

export function isScrollable(
  element: HTMLElement,
  axis: ScrollAxis,
  allowOverflowIntent = false,
): boolean {
  return axis === 'vertical'
    ? isScrollableY(element, allowOverflowIntent)
    : isScrollableX(element, allowOverflowIntent);
}

export function hasScrollableAncestor(
  target: EventTarget | null,
  root: HTMLElement,
  axes: ScrollAxis[],
): boolean {
  // `getParentNode` crosses shadow boundaries (and slots), so a target inside a shadow root
  // still walks up to scrollable ancestors in the light DOM. Non-HTML targets (SVG, MathML)
  // can't scroll, but their HTML ancestors can.
  let node: EventTarget | null = target;
  while (isElement(node) && node !== root && !isLastTraversableNode(node)) {
    if (isHTMLElement(node)) {
      for (const axis of axes) {
        if (isScrollable(node, axis)) {
          return true;
        }
      }
    }
    node = getParentNode(node);
  }
  return false;
}

export function findScrollableTouchTarget(
  target: EventTarget | null | undefined,
  root: HTMLElement,
  axis: ScrollAxis = 'vertical',
  allowOverflowIntent = false,
): HTMLElement | null {
  // `getParentNode` crosses shadow boundaries (and slots), so a target inside a shadow root
  // still reaches a scrollable ancestor in the light DOM. Non-HTML targets (SVG, MathML)
  // can't scroll, but their HTML ancestors can.
  let node: EventTarget | null | undefined = target;
  while (isElement(node) && node !== root && !isLastTraversableNode(node)) {
    if (isHTMLElement(node) && isScrollable(node, axis, allowOverflowIntent)) {
      return node;
    }
    node = getParentNode(node);
  }

  return isScrollable(root, axis, allowOverflowIntent) ? root : null;
}
