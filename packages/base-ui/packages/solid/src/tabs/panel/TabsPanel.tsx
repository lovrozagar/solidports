import { createEffect, getOwner, isStatic, onCleanup, runWithOwner, Show, untrack } from 'solid-js';
import { createNativeConditional } from '../../utils/native/conditional';
import { createEffectGroup } from '../../utils/native/effectGroup';
import type { JSX } from '@solidjs/web';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { createDepsEffect, splitComponentProps } from '../../solid-helpers';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import { createNativeListItem, type NativeListItem } from '../../utils/native/listItem';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useAnimationsFinished } from '../../utils/useAnimationsFinished';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTransitionStatus, type TransitionStatus } from '../../utils/useTransitionStatus';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import type { TabsRootState } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsTab } from '../tab/TabsTab';
import { TabsPanelDataAttributes } from './TabsPanelDataAttributes';

const stateAttributesMapping: StateAttributesMapping<TabsPanelState> = {
  ...tabsStateAttributesMapping,
  ...transitionStatusMapping,
};

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['value', 'keepMounted']);
const TABPANEL: Record<string, unknown> = { role: 'tabpanel' };

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsPanel(componentProps: TabsPanel.Props): JSX.Element {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a `<div>` rendered with direct
  // JSX; a hidden panel creates its transition, completion and registration machinery when it
  // first renders.
  if (canRenderNative(componentProps)) {
    return NativeTabsPanel(componentProps);
  }

  const [, local, elementProps] = splitComponentProps(componentProps, ['value', 'keepMounted']);
  const keepMounted = () => local.keepMounted ?? false;

  const {
    value: selectedValue,
    getTabIdByPanelValue,
    orientation,
    tabActivationDirection,
    registerMountedTabPanel,
  } = useTabsRootContext();

  const id = useBaseUiId();

  const { setRef: setListItemRef, index } = useCompositeListItem();

  const open = () => local.value === selectedValue();
  const { mounted, transitionStatus, setMounted } = useTransitionStatus(open);
  const hidden = () => !mounted();

  const correspondingTabId = () => getTabIdByPanelValue(local.value);

  const state: TabsPanelState = {
    get hidden() {
      return hidden();
    },
    get orientation() {
      return orientation();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  let panelRef = null as HTMLDivElement | null | undefined;

  const element = useRenderElement('div', componentProps, {
    state,
    ref: (el) => {
      panelRef = el;
      setListItemRef(el);
    },
    props: [
      {
        role: 'tabpanel',
        get 'aria-labelledby'() {
          return correspondingTabId();
        },
        get hidden() {
          return hidden();
        },
        get id() {
          return id();
        },
        get tabindex() {
          return open() ? 0 : -1;
        },
        get inert() {
          return !open();
        },
        // Computed key: a plain literal key fails the DOM-props excess property check.
        get [TabsPanelDataAttributes.index as string]() {
          return index();
        },
      },
      elementProps,
    ],
    stateAttributesMapping,
  });

  useOpenChangeComplete({
    onComplete() {
      if (!open()) {
        setMounted(false);
      }
    },
    open,
    ref: () => panelRef,
  });

  createDepsEffect(
    () => ({ hidden: hidden(), keepMounted: keepMounted(), value: local.value, id: id() }),
    (deps) => {
      if (deps.id == null || (deps.hidden && !deps.keepMounted)) {
        return undefined;
      }

      return registerMountedTabPanel(deps.value, deps.id);
    },
  );

  const shouldRender = () => keepMounted() || mounted();

  return <Show when={shouldRender()}>{element()}</Show>;
}

/** Panels rendered in DOM order get their index on the first render (the list's flush confirms it). */
const GUESS_INDEX = { guessIndex: true };

function NativeTabsPanel(props: TabsPanel.Props): JSX.Element {
  const owner = getOwner();
  const keepMounted = () => props.keepMounted ?? false;

  const {
    value: selectedValue,
    getTabIdByPanelValue,
    orientation,
    tabActivationDirection,
    registerMountedTabPanel,
  } = useTabsRootContext();

  const id = useBaseUiId();
  const open = () => props.value === selectedValue();
  const correspondingTabId = () => getTabIdByPanelValue(props.value);

  // A hidden panel has nothing to transition or complete: its list registration is created when
  // it first renders and its transition status (with the open-complete watcher) when it first
  // opens, both owned by the part and kept. Created once the panel is already open, the
  // transition status still enters `'starting'` as an eager instance would on that open
  // (`animateInitialOpen`), unless the panel was open when the part was created.
  const initialOpen = untrack(open);
  let transition: ReturnType<typeof useTransitionStatus> | undefined;
  let panelRef = null as HTMLDivElement | null;
  const createTransition = () =>
    (transition ??= runWithOwner(owner, () =>
      untrack(() => {
        const status = useTransitionStatus(open, false, false, !initialOpen);
        // `useOpenChangeComplete({ open, ref })`: it runs on every open change; a hidden panel's
        // initial run (no animations to wait for, `setMounted(false)` on an unmounted panel) has
        // no effect, so the watcher starts with the first open.
        let runOnceAnimationsFinish: ReturnType<typeof useAnimationsFinished> | undefined;
        createEffect(
          () => open(),
          () => {
            runOnceAnimationsFinish ??= useAnimationsFinished(() => panelRef, open);
            const onComplete = () => {
              if (!untrack(open)) {
                status.setMounted(false);
              }
            };
            if (panelRef == null) {
              runOnceAnimationsFinish(onComplete);
              return undefined;
            }
            const abortController = new AbortController();
            runOnceAnimationsFinish(onComplete, abortController.signal);
            return () => abortController.abort();
          },
        );
        return status;
      }),
    )!);
  const ensureTransition = () => {
    if (transition === undefined && open()) {
      createTransition();
    }
    return transition;
  };
  const mounted = () => ensureTransition()?.mounted() ?? false;
  const transitionStatus = () => ensureTransition()?.transitionStatus();

  // The registration with the root (`aria-controls` of the tab) follows `hidden`, `keepMounted`,
  // `value` and `id`: a statically kept-mounted panel with a static value is registered from its
  // element's ref and unregistered with the part (no node); otherwise one effect.
  const staticRegistration =
    (!('keepMounted' in props) || isStatic(props, 'keepMounted')) &&
    (!('value' in props) || isStatic(props, 'value')) &&
    untrack(keepMounted);
  let unregister: (() => void) | undefined;
  if (staticRegistration) {
    onCleanup(() => unregister?.());
  }

  let listItem: NativeListItem | undefined;
  const getListItem = () =>
    (listItem ??= runWithOwner(owner, () =>
      untrack(() => {
        const item = createNativeListItem<null>(null, GUESS_INDEX);
        if (!staticRegistration) {
          createEffectGroup([
            {
              deps: () => ({
                hidden: !mounted(),
                keepMounted: keepMounted(),
                value: props.value,
                id: id(),
              }),
              apply(deps) {
                if (deps.id == null || (deps.hidden && !deps.keepMounted)) {
                  return undefined;
                }

                return registerMountedTabPanel(deps.value, deps.id);
              },
            },
          ]);
        }
        return item;
      }),
    )!);
  const setPanelRef = (el: HTMLDivElement | null) => {
    panelRef = el;
    getListItem().setRef(el);
    if (staticRegistration && el && unregister === undefined) {
      unregister = registerMountedTabPanel(untrack(() => props.value), untrack(id)!);
    }
  };

  const state: TabsPanelState = {
    get hidden() {
      return !mounted();
    },
    get orientation() {
      return orientation();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const shouldRender = () => keepMounted() || mounted();

  return createNativeConditional(owner, shouldRender, () =>
    renderNativeElement((<div />) as unknown as Element, props, {
        own: OWN_KEYS,
        state,
        mapping: stateAttributesMapping,
        reactive: true,
        literal: TABPANEL,
        attributes: (set) => {
          set('aria-labelledby', correspondingTabId());
          set('hidden', !mounted());
          set('id', id());
          set('tabindex', open() ? 0 : -1);
          set('inert', !open());
          set(TabsPanelDataAttributes.index, getListItem().index());
        },
        refs: [setPanelRef],
      }),
  ) as unknown as JSX.Element;
}

export interface TabsPanelMetadata {
  id?: string | undefined;
  value: TabsTab.Value;
}

export interface TabsPanelState extends TabsRootState {
  /**
   * Whether the component is hidden.
   */
  hidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TabsPanelProps extends BaseUIComponentProps<'div', TabsPanelState> {
  /**
   * The value of the TabPanel. It will be shown when the Tab with the corresponding value is active.
   */
  value: TabsTab.Value;
  /**
   * Whether to keep the HTML element in the DOM while the panel is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace TabsPanel {
  export type Metadata = TabsPanelMetadata;
  export type State = TabsPanelState;
  export type Props = TabsPanelProps;
}
