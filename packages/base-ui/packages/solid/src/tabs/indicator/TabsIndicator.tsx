import { createMemo, createSignal, onSettled, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getParentNode, isHTMLElement, isLastTraversableNode } from '@floating-ui/utils/dom';
import { PrehydrationScript } from '../../internals/PrehydrationScript';
import { splitComponentProps } from '../../solid-helpers';
import { getCssDimensions } from '../../utils/getCssDimensions';
import { getElementTransform } from '../../utils/getElementTransform';
import { ownerWindow } from '../../utils/owner';
import type { BaseUIComponentProps } from '../../utils/types';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTabsListContext } from '../list/TabsListContext';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import type { TabsRoot, TabsRootState } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsTab } from '../tab/TabsTab';
import { script as prehydrationScript } from './prehydrationScript.min';
import { TabsIndicatorCssVars } from './TabsIndicatorCssVars';

const stateAttributesMapping = {
  ...tabsStateAttributesMapping,
  activeTabPosition: () => null,
  activeTabSize: () => null,
};

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['renderBeforeHydration']);
const PRESENTATION: Record<string, unknown> = { role: 'presentation' };

// `offsetLeft`/`offsetTop` are rounded to whole pixels and the error can compound
// across the offset parent chain.
const MAX_LAYOUT_ROUNDING_ERROR = 2;

/**
 * A visual indicator that can be styled to match the position of the currently active tab.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsIndicator(componentProps: TabsIndicator.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['renderBeforeHydration']);
  const renderBeforeHydration = () => local.renderBeforeHydration ?? false;

  const { getTabElementBySelectedValue, orientation, tabActivationDirection, value } =
    useTabsRootContext();

  const { tabsListElement, registerIndicatorUpdateListener } = useTabsListContext();

  // Solid: React's `useForcedRerendering`; the measurement memo below tracks this tick.
  const [renderTick, rerender] = createSignal(undefined, { equals: false });

  onSettled(() => {
    return registerIndicatorUpdateListener(rerender);
  });

  // Solid: React measures on every render; this memo re-measures when its inputs change.
  const measurement = createMemo(() => {
    renderTick();

    let left = 0;
    let right = 0;
    let top = 0;
    let bottom = 0;
    let width = 0;
    let height = 0;

    let isTabSelected = false;

    const selectedValue = value();
    const listElement = tabsListElement();

    if (selectedValue != null && listElement != null) {
      const activeTab = getTabElementBySelectedValue(selectedValue);

      if (activeTab != null) {
        isTabSelected = true;

        const { width: computedWidth, height: computedHeight } = getCssDimensions(activeTab);
        const { width: tabListWidth, height: tabListHeight } = getCssDimensions(listElement);
        const tabRect = activeTab.getBoundingClientRect();
        const tabsListRect = listElement.getBoundingClientRect();
        const scaleX = tabListWidth > 0 ? tabsListRect.width / tabListWidth : 1;
        const scaleY = tabListHeight > 0 ? tabsListRect.height / tabListHeight : 1;

        // Layout offsets are immune to transforms, but lose sub-pixel precision.
        const layoutOffset = getLayoutOffset(activeTab, listElement);
        left = layoutOffset.left;
        top = layoutOffset.top;

        const rectLeft =
          (tabRect.left - tabsListRect.left) / scaleX +
          listElement.scrollLeft -
          listElement.clientLeft;
        const rectTop =
          (tabRect.top - tabsListRect.top) / scaleY + listElement.scrollTop - listElement.clientTop;

        // The rect-based offset is sub-pixel-precise but is derived from projected viewport
        // geometry: a rotation, skew, flip, perspective, or 3D transform on the tab or any
        // ancestor warps it beyond what the scale division can undo. When it agrees with the
        // layout offset (up to layout rounding), no distortion is in effect and the more
        // precise value is safe to use. A tab list scaled to zero divides by zero just above,
        // and the resulting `NaN`/`Infinity` fails this same check, leaving the layout offset
        // in place — so a degenerate scale needs no guard of its own.
        //
        // The active tab's own translation moves the rect but not the layout offset, so
        // strip it from the comparison. This lets the indicator follow tab-local animations
        // (e.g. `transform: translateX(12px)` on the selected tab) — the indicator is a
        // sibling of the tab and does not inherit its transform.
        const tabTranslation = getActiveTabTranslation(activeTab);
        if (
          Math.abs(rectLeft - tabTranslation.x - left) <= MAX_LAYOUT_ROUNDING_ERROR &&
          Math.abs(rectTop - tabTranslation.y - top) <= MAX_LAYOUT_ROUNDING_ERROR
        ) {
          left = rectLeft;
          top = rectTop;
        }

        width = computedWidth;
        height = computedHeight;
        right = listElement.scrollWidth - left - width;
        bottom = listElement.scrollHeight - top - height;
      }
    }

    return { isTabSelected, left, right, top, bottom, width, height };
  });

  const activeTabPosition = createMemo(() => {
    const { isTabSelected, left, right, top, bottom } = measurement();
    return isTabSelected ? { left, right, top, bottom } : null;
  });

  const activeTabSize = createMemo(() => {
    const { isTabSelected, width, height } = measurement();
    return isTabSelected ? { width, height } : null;
  });

  const style = createMemo(() => {
    const { isTabSelected, left, right, top, bottom, width, height } = measurement();
    return isTabSelected
      ? ({
          [TabsIndicatorCssVars.activeTabLeft]: `${left}px`,
          [TabsIndicatorCssVars.activeTabRight]: `${right}px`,
          [TabsIndicatorCssVars.activeTabTop]: `${top}px`,
          [TabsIndicatorCssVars.activeTabBottom]: `${bottom}px`,
          [TabsIndicatorCssVars.activeTabWidth]: `${width}px`,
          [TabsIndicatorCssVars.activeTabHeight]: `${height}px`,
        } as JSX.CSSProperties)
      : undefined;
  });

  const displayIndicator = () => {
    const { isTabSelected, width, height } = measurement();
    return isTabSelected && width > 0 && height > 0;
  };

  const state: TabsIndicatorState = {
    get orientation() {
      return orientation();
    },
    get activeTabPosition() {
      return activeTabPosition();
    },
    get activeTabSize() {
      return activeTabSize();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
  };

  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a `<span>` rendered with direct
  // JSX; the measurement memos above are the same in both paths.
  const element = canRenderNative(componentProps)
    ? () =>
        renderNativeElement((<span />) as unknown as Element, componentProps, {
          own: OWN_KEYS,
          state,
          mapping: stateAttributesMapping,
          reactive: true,
          literal: PRESENTATION,
          // Hidden until the layout is settled.
          attributes: (set) => set('hidden', !displayIndicator()),
          partStyle: style,
        }) as unknown as JSX.Element
    : useRenderElement('span', componentProps, {
        state,
        props: [
          {
            role: 'presentation',
            get style() {
              return style();
            },
            get hidden() {
              return !displayIndicator(); // do not display the indicator before the layout is settled
            },
          },
          elementProps,
        ],
        stateAttributesMapping,
      });

  return (
    <Show when={value() != null}>
      {element()}
      <Show when={renderBeforeHydration()}>
        <PrehydrationScript script={prehydrationScript} />
      </Show>
    </Show>
  );
}

export interface TabsIndicatorState extends TabsRootState {
  /**
   * The active tab position.
   */
  activeTabPosition: TabsTab.Position | null;
  /**
   * The active tab size.
   */
  activeTabSize: TabsTab.Size | null;
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
}

export interface TabsIndicatorProps extends BaseUIComponentProps<'span', TabsIndicatorState> {
  /**
   * Whether to render itself before React hydrates.
   * This minimizes the time that the indicator isn't visible after server-side rendering.
   * @default false
   */
  renderBeforeHydration?: boolean | undefined;
}

export namespace TabsIndicator {
  export type State = TabsIndicatorState;
  export type Props = TabsIndicatorProps;
}

function getLayoutOffset(element: HTMLElement, ancestor: HTMLElement) {
  const elementOffset = getCumulativeOffset(element);
  const ancestorOffset = getCumulativeOffset(ancestor);

  let left = elementOffset.left - ancestorOffset.left - ancestor.clientLeft;
  let top = elementOffset.top - ancestorOffset.top - ancestor.clientTop;

  // `offsetLeft`/`offsetTop` describe layout, and scrolling doesn't change layout: a scroll
  // container between the tab and the list moves the tab on screen while its layout slot stays
  // put. Subtract that scroll so this offset remains comparable with the rect-based one below —
  // otherwise the difference reads as transform distortion, the rect offset is rejected, and the
  // indicator is left behind by the full scroll amount. The list's own scroll is deliberately
  // excluded: the indicator sits inside it and scrolls along with the tab.
  //
  // `getParentNode` crosses shadow boundaries (and slots), so a tab inside a shadow root still
  // reaches the scroll containers between it and the list.
  let node: Node | null = getParentNode(element);
  while (isHTMLElement(node) && node !== ancestor && !isLastTraversableNode(node)) {
    left -= node.scrollLeft;
    top -= node.scrollTop;
    node = getParentNode(node);
  }

  return { left, top };
}

function getCumulativeOffset(element: HTMLElement) {
  let left = 0;
  let top = 0;
  let currentElement: HTMLElement | null = element;

  while (currentElement != null) {
    left += currentElement.offsetLeft;
    top += currentElement.offsetTop;

    const offsetParent = currentElement.offsetParent as HTMLElement | null;
    if (offsetParent != null) {
      left += offsetParent.clientLeft;
      top += offsetParent.clientTop;
    }

    currentElement = offsetParent;
  }

  return { left, top };
}

// Returns the active tab's own 2D translation, in CSS pixels: the translation component of
// the computed `transform` matrix plus the `translate` longhand. CSS composes the two as
// `translate → rotate → scale → transform`, so adding them is only exact when no rotation or
// scale is in play. That is enough here: with either of those present the caller's agreement
// check rejects the rect-based offset regardless of the translation, and the tab's layout
// slot is used instead.
function getActiveTabTranslation(element: HTMLElement) {
  const computedStyle = ownerWindow(element).getComputedStyle(element);
  const { x, y } = getElementTransform(element, computedStyle);
  let translateX = x;
  let translateY = y;

  // The `translate` longhand is a separate property and is not reflected in the
  // computed `transform` matrix that `getElementTransform` reads. `getComputedStyle`
  // resolves absolute and font-relative lengths to pixels but keeps percentages, which
  // resolve against the tab's border box.
  const { translate } = computedStyle;
  if (translate && translate !== 'none') {
    const parts = translate.split(' ');
    translateX += resolveTranslateLength(parts[0], element.offsetWidth);
    translateY += resolveTranslateLength(parts[1], element.offsetHeight);
  }

  return { x: translateX, y: translateY };
}

// Resolves a single `translate` longhand component to pixels. Percentages resolve against
// the given border-box size; anything that isn't a plain number or percentage (e.g.
// `calc(...)`) is treated as no translation, so the indicator falls back to the tab's
// layout slot rather than guessing.
function resolveTranslateLength(value: string | undefined, referenceSize: number): number {
  if (!value) {
    return 0;
  }
  const numeric = parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return value.endsWith('%') ? (numeric / 100) * referenceSize : numeric;
}
