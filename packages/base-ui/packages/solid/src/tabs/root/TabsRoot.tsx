import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { createComponent } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { canRenderNative } from '../../utils/native';
import { provideNativeContext } from '../../utils/native/context';
import { renderNativeElement } from '../../utils/native/element';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { createDepsEffect, splitComponentProps } from '../../solid-helpers';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import type { Orientation as BaseOrientation, BaseUIComponentProps } from '../../utils/types';
import { useControlled } from '../../utils/useControlled';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TabsPanel } from '../panel/TabsPanel';
import type { TabsTab } from '../tab/TabsTab';
import { TabsRootContext } from './TabsRootContext';
import { tabsStateAttributesMapping } from './stateAttributesMapping';

type TabMap = Map<Node, CompositeMetadata<TabsTab.Metadata>>;

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsRoot(componentProps: TabsRoot.Props): JSX.Element {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a `<div>` rendered with direct
  // JSX and the root context on one owner; the panel list stays `CompositeList`.
  if (canRenderNative(componentProps)) {
    const root = createTabsRoot(componentProps);
    return provideNativeContext(TabsRootContext, root.tabsContextValue, () =>
      createComponent(CompositeList<TabsPanel.Metadata>, {
        refs: { elements: root.tabPanelRefs },
        get children() {
          return renderNativeElement((<div />) as unknown as Element, componentProps, {
            own: OWN_KEYS,
            state: root.state,
            mapping: tabsStateAttributesMapping,
            reactive: true,
          }) as unknown as JSX.Element;
        },
      }),
    );
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'defaultValue',
    'onValueChange',
    'orientation',
    'value',
  ]);
  const root = createTabsRoot(local);

  const element = useRenderElement('div', componentProps, {
    state: root.state,
    props: elementProps,
    stateAttributesMapping: tabsStateAttributesMapping,
  });

  return (
    <TabsRootContext value={root.tabsContextValue}>
      <CompositeList<TabsPanel.Metadata> refs={{ elements: root.tabPanelRefs }}>
        {element()}
      </CompositeList>
    </TabsRootContext>
  );
}

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set([
  'defaultValue',
  'onValueChange',
  'orientation',
  'value',
]);

/** The root's value state, activation direction and context, shared by both render paths. */
function createTabsRoot(
  local: Pick<TabsRoot.Props, 'defaultValue' | 'onValueChange' | 'orientation' | 'value'>,
) {
  const defaultValueProp = () => (local.defaultValue === undefined ? 0 : local.defaultValue);
  const orientation = () => local.orientation ?? 'horizontal';
  const valueProp = () => local.value;

  // Track whether the user explicitly provided a defined `defaultValue` prop.
  // Used to determine if we should honor a disabled tab selection.
  const hasExplicitDefaultValueProp = untrack(() => local.defaultValue !== undefined);

  const tabPanelRefs: (HTMLElement | null | undefined)[] = [];
  // The mounted panels' ids by value: one map mutated in place with a version signal readers
  // track (React copies the map per registration; with 200 panels that is quadratic). Every read
  // tracks the version, as a read of the map signal would. Solid: panels unregister from unmount
  // cleanups, so the version allows owned writes.
  const mountedTabPanels = new Map<TabsTab.Value, string>();
  const [mountedTabPanelsVersion, setMountedTabPanelsVersion] = createSignal(0, {
    ownedWrite: true,
  });

  const [value, setValue] = useControlled({
    controlled: valueProp,
    default: defaultValueProp,
    name: 'Tabs',
    state: 'value',
  });

  const isControlled = () => valueProp() !== undefined;

  const [tabMap, setTabMapState] = createSignal<TabMap>(new Map());
  // The first tab's id per value, rebuilt with the tab map (a per-panel scan of 200 tabs is
  // quadratic); read through `tabMap()` so readers track the same signal.
  let tabIdsByValue = new Map<TabsTab.Value, string | undefined>();
  let lastKnownTabElement: Node | undefined;

  // Solid: `CompositeList` publishes the sorted items as an array.
  const setTabMap = (
    entries: Array<{ element: Element; metadata: CompositeMetadata<TabsTab.Metadata> | null }>,
  ) => {
    const nextTabMap: TabMap = new Map();
    const nextIds = new Map<TabsTab.Value, string | undefined>();
    entries.forEach(({ element, metadata }) => {
      if (metadata != null) {
        nextTabMap.set(element, metadata);
        if (!nextIds.has(metadata.value)) {
          nextIds.set(metadata.value, metadata.id);
        }
      }
    });
    tabIdsByValue = nextIds;
    setTabMapState(nextTabMap);
  };

  // Used for activation direction detection via tab element positions.
  const getTabElementBySelectedValue = (selectedValue: TabsTab.Value): HTMLElement | null =>
    findTabElement(tabMap(), selectedValue);

  // React computes the direction during render from a previous-value snapshot it syncs after
  // commit (https://github.com/mui/base-ui/issues/3873). Solid derives it in the same flush: a
  // writable memo whose previous value is that snapshot. The automatic fallback below writes it.
  const [activationDirectionState, setActivationDirectionState] = createSignal<{
    previousValue: TabsTab.Value;
    tabActivationDirection: TabsTab.ActivationDirection;
  }>((prev) => {
    const currentValue = value();
    if (prev === undefined) {
      return { previousValue: currentValue, tabActivationDirection: 'none' };
    }
    const { previousValue } = prev;
    if (previousValue === currentValue) {
      return prev;
    }
    const tabActivationDirection = computeActivationDirection(
      previousValue,
      currentValue,
      orientation(),
      tabMap(),
    );
    // When a new tab is added and selected in the same controlled update, the tab element may
    // not be registered yet, so the direction came from a value-based fallback. Keep the previous
    // value so it is computed again from DOM positions once the tab registers.
    const directionComputationIncomplete =
      previousValue != null &&
      currentValue != null &&
      findTabElement(tabMap(), currentValue) == null;
    return {
      previousValue: directionComputationIncomplete ? previousValue : currentValue,
      tabActivationDirection,
    };
  });
  const tabActivationDirection = () => activationDirectionState().tabActivationDirection;

  // Solid: a handler reading the latest values is React's stable callback.
  const onValueChange = (newValue: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => {
    const nextActivationDirection = computeActivationDirection(
      untrack(value),
      newValue,
      untrack(orientation),
      untrack(tabMap),
    );

    eventDetails.activationDirection = nextActivationDirection;

    local.onValueChange?.(newValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValue(newValue);
  };

  const notifyAutomaticValueChange = (
    nextValue: TabsTab.Value,
    reason: TabsRoot.ChangeEventReason,
  ) => {
    local.onValueChange?.(
      nextValue,
      createChangeEventDetails(reason, undefined, undefined, {
        activationDirection: 'none',
      }),
    );
  };

  const registerMountedTabPanel = (panelValue: TabsTab.Value, panelId: string) => {
    mountedTabPanels.set(panelValue, panelId);
    setMountedTabPanelsVersion((version) => version + 1);

    return () => {
      // Another panel with the same value took ownership in the meantime;
      // leave its registration in place.
      if (mountedTabPanels.get(panelValue) !== panelId) {
        return;
      }

      mountedTabPanels.delete(panelValue);
      setMountedTabPanelsVersion((version) => version + 1);
    };
  };

  // get the `id` attribute of <Tabs.Panel> to set as the value of `aria-controls` on <Tabs.Tab>
  const getTabPanelIdByValue = (tabValue: TabsTab.Value) => {
    mountedTabPanelsVersion();
    return mountedTabPanels.get(tabValue);
  };

  // get the `id` attribute of <Tabs.Tab> to set as the value of `aria-labelledby` on <Tabs.Panel>
  const getTabIdByPanelValue = (tabPanelValue: TabsTab.Value) => {
    tabMap();
    return tabIdsByValue.get(tabPanelValue);
  };

  const tabsContextValue: TabsRootContext = {
    getTabElementBySelectedValue,
    getTabIdByPanelValue,
    getTabPanelIdByValue,
    onValueChange,
    orientation,
    registerMountedTabPanel,
    setTabMap,
    tabActivationDirection,
    value,
  };

  const selectedTabMetadata = createMemo(() => {
    for (const tabMetadata of tabMap().values()) {
      if (tabMetadata.value === value()) {
        return tabMetadata;
      }
    }
    return undefined;
  });

  // Find the first non-disabled tab value.
  // Used as a fallback when the current selection is disabled or missing.
  const firstEnabledTabValue = createMemo(() => {
    for (const tabMetadata of tabMap().values()) {
      if (!tabMetadata.disabled) {
        return tabMetadata.value;
      }
    }
    return undefined;
  });

  // Implicit uncontrolled selections are still automatic changes, so notify
  // once when the tabs first register. Explicit defaults are treated as user-owned.
  let shouldNotifyInitialValueChange = !hasExplicitDefaultValueProp;
  // useControlled warns if defaultValue changes after mount, but the
  // disabled-default honor policy below still needs a stable initial value.
  const initialDefaultValue = untrack(defaultValueProp);
  // An explicit defaultValue can intentionally point at a disabled tab on mount.
  // Once that selection becomes valid, later disabled states should fall back.
  let shouldHonorDisabledDefaultValue = hasExplicitDefaultValueProp;
  let didRegisterTabs = false;

  // Uncontrolled roots own automatic fallback. Controlled roots keep the exact
  // value supplied by the parent, even when that tab is disabled or missing.
  // Solid: a user effect, since a render effect's mount-time apply may not write signals.
  createEffect(
    () => ({
      firstEnabledTabValue: firstEnabledTabValue(),
      isControlled: isControlled(),
      selectedTabMetadata: selectedTabMetadata(),
      tabMap: tabMap(),
      value: value(),
    }),
    (deps) => {
      if (deps.isControlled) {
        return;
      }

      const currentValue = deps.value;

      function commitAutomaticValueChange(
        fallbackValue: TabsTab.Value,
        fallbackReason: TabsRoot.ChangeEventReason,
      ) {
        setValue(fallbackValue);
        // Automatic fallbacks are not directional transitions; reset the direction
        // alongside the value so the batched commit keeps both in sync.
        setActivationDirectionState({
          previousValue: fallbackValue,
          tabActivationDirection: 'none',
        });
        notifyAutomaticValueChange(fallbackValue, fallbackReason);
        // Mark the initial notification as delivered only after the consumer
        // callback returns. The fallback value is queued first so automatic
        // consistency updates are not cancelable through a throwing handler.
        shouldNotifyInitialValueChange = false;
      }

      if (deps.tabMap.size === 0) {
        // A Suspense boundary outside the root can clean up layout effects while
        // keeping the previous tabs connected. Don't treat that as removal.
        if (didRegisterTabs && currentValue !== null && !lastKnownTabElement?.isConnected) {
          commitAutomaticValueChange(null, REASONS.missing);
        }
        return;
      }

      didRegisterTabs = true;
      lastKnownTabElement = deps.tabMap.keys().next().value;

      const selectionIsDisabled = deps.selectedTabMetadata?.disabled;
      const selectionIsMissing = deps.selectedTabMetadata == null && currentValue !== null;

      if (!selectionIsDisabled && currentValue === initialDefaultValue) {
        shouldHonorDisabledDefaultValue = false;
      }

      if (
        shouldHonorDisabledDefaultValue &&
        selectionIsDisabled &&
        currentValue === initialDefaultValue
      ) {
        return;
      }

      const shouldNotifyInitial = shouldNotifyInitialValueChange;

      if (selectionIsDisabled || selectionIsMissing) {
        const fallbackValue = deps.firstEnabledTabValue ?? null;

        if (currentValue === fallbackValue) {
          // Already at the fallback value; no commit or notification needed,
          // but record that the implicit-initial transition has resolved.
          shouldNotifyInitialValueChange = false;
          return;
        }

        let fallbackReason: TabsRoot.ChangeEventReason = REASONS.missing;

        if (shouldNotifyInitial) {
          fallbackReason = REASONS.initial;
        } else if (selectionIsDisabled) {
          fallbackReason = REASONS.disabled;
        }

        commitAutomaticValueChange(fallbackValue, fallbackReason);
        return;
      }

      if (shouldNotifyInitial && deps.selectedTabMetadata != null) {
        notifyAutomaticValueChange(currentValue, REASONS.initial);
        shouldNotifyInitialValueChange = false;
      }
    },
  );

  const state: TabsRootState = {
    get orientation() {
      return orientation();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
  };

  return { state, tabPanelRefs, tabsContextValue };
}

function findTabElement(tabMap: TabMap, value: TabsTab.Value): HTMLElement | null {
  for (const [tabElement, tabMetadata] of tabMap.entries()) {
    if (value === tabMetadata.value) {
      return tabElement as HTMLElement;
    }
  }

  return null;
}

function computeActivationDirection(
  oldValue: TabsTab.Value | null,
  newValue: TabsTab.Value | null,
  orientation: 'horizontal' | 'vertical',
  tabMap: TabMap,
): TabsTab.ActivationDirection {
  if (oldValue == null || newValue == null) {
    return 'none';
  }

  const [positionProp, backward, forward] =
    orientation === 'horizontal'
      ? (['left', 'left', 'right'] as const)
      : (['top', 'up', 'down'] as const);

  const oldTab = findTabElement(tabMap, oldValue);
  const newTab = findTabElement(tabMap, newValue);

  if (oldTab == null || newTab == null) {
    // Fallback for dynamic tabs: when a tab element isn't registered yet
    // (e.g. added and selected in the same update), infer direction from
    // the values themselves. Works for comparable types (numbers, strings).
    if (
      oldTab !== newTab &&
      (typeof oldValue === 'number' || typeof oldValue === 'string') &&
      typeof oldValue === typeof newValue
    ) {
      return newValue > oldValue ? forward : backward;
    }
    return 'none';
  }

  const oldPosition = oldTab.getBoundingClientRect()[positionProp];
  const newPosition = newTab.getBoundingClientRect()[positionProp];

  if (newPosition < oldPosition) {
    return backward;
  }
  if (newPosition > oldPosition) {
    return forward;
  }

  return 'none';
}

export type TabsRootOrientation = BaseOrientation;

export interface TabsRootState {
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsRootProps extends BaseUIComponentProps<'div', TabsRootState> {
  /**
   * The value of the currently active `Tab`. Use when the component is controlled.
   * When the value is `null`, no Tab will be active.
   */
  value?: TabsTab.Value | undefined;
  /**
   * The default value. Use when the component is not controlled.
   * When the value is `null`, no Tab will be active.
   * @default 0
   */
  defaultValue?: TabsTab.Value | undefined;
  /**
   * The component orientation (layout flow direction).
   * @default 'horizontal'
   */
  orientation?: TabsRoot.Orientation | undefined;
  /**
   * Callback invoked when new value is being set.
   *
   * The event `reason` is `'none'` for user-initiated changes, such as a click
   * or keyboard navigation; `'initial'` for the first automatic selection or
   * fallback in uncontrolled roots when `defaultValue` is omitted or
   * `undefined`, including when the implicit initial value is disabled or
   * missing; `'disabled'` for automatic fallback when the selected tab becomes
   * disabled in uncontrolled roots; or `'missing'` for automatic fallback when
   * the selected tab is removed, or when an explicit `defaultValue` never
   * matches a mounted tab in uncontrolled roots.
   *
   * For automatic changes, the selected value can be `null` when no enabled Tab
   * is available as a fallback.
   *
   * Automatic changes cannot be canceled; calling `eventDetails.cancel()` for
   * `'initial'`, `'disabled'`, or `'missing'` has no effect.
   */
  onValueChange?:
    ((value: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => void) | undefined;
}

export type TabsRootChangeEventReason =
  typeof REASONS.none | typeof REASONS.disabled | typeof REASONS.missing | typeof REASONS.initial;
export type TabsRootChangeEventDetails = BaseUIChangeEventDetails<
  TabsRoot.ChangeEventReason,
  { activationDirection: TabsTab.ActivationDirection }
>;

export namespace TabsRoot {
  export type State = TabsRootState;
  export type Props = TabsRootProps;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}
