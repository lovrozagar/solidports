import { getOwner, omit, runWithOwner, Show, untrack } from 'solid-js';
import { createNativeConditional } from '../../utils/native/conditional';
import type { JSX } from '@solidjs/web';
import { createDepsEffect, createDepsRenderEffect, splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { isServer } from '@solidjs/web';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceAccessor } from '../../utils/propsView';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { warn } from '../../utils/warn';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import type { CollapsibleRootState } from '../root/CollapsibleRoot';
import { collapsibleStateAttributesMapping } from '../root/stateAttributesMapping';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement, type SetAttribute } from '../../utils/native/element';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { createIdRegistration } from '../../utils/native/registration';
import { useCollapsiblePanel } from './useCollapsiblePanel';
import { CollapsiblePanelCssVars } from './CollapsiblePanelCssVars';
import { CollapsiblePanelDataAttributes } from './CollapsiblePanelDataAttributes';

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export function CollapsiblePanel(componentProps: CollapsiblePanel.Props) {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a `<div>` rendered with direct
  // JSX; the panel's measurement machinery is created when the panel first renders.
  if (canRenderNative(componentProps)) {
    return NativeCollapsiblePanel(componentProps);
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'hiddenUntilFound',
    'keepMounted',
    'id',
    'style',
  ]);

  if (process.env.NODE_ENV !== 'production') {
    warnKeepMountedIgnored(
      () => local.hiddenUntilFound,
      () => local.keepMounted,
      'The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
    );
  }

  const {
    defaultPanelId,
    mounted,
    onOpenChange,
    open,
    setMounted,
    setPanelIdState,
    setOpen,
    state,
    transitionStatus,
  } = useCollapsibleRootContext();

  const hiddenUntilFound = () => local.hiddenUntilFound ?? false;
  const keepMounted = () => local.keepMounted ?? false;
  const registeredId = () => local.id || undefined;
  const id = () => registeredId() ?? defaultPanelId();

  createDepsRenderEffect(registeredId, (currentRegisteredId) => {
    setPanelIdState(
      (currentId) => currentRegisteredId ?? (currentId === null ? undefined : currentId),
    );
    return () => {
      setPanelIdState((currentId) => (currentId === currentRegisteredId ? null : currentId));
    };
  });

  const panel = useCollapsiblePanel({
    dimensionCssVars: {
      height: CollapsiblePanelCssVars.collapsiblePanelHeight,
      width: CollapsiblePanelCssVars.collapsiblePanelWidth,
    },
    hiddenUntilFound,
    id,
    keepMounted,
    mounted,
    onOpenChange,
    open,
    setMounted,
    setOpen,
    transitionStatus,
  });

  const panelState: CollapsiblePanelState = {
    get open() {
      return state.open;
    },
    get disabled() {
      return state.disabled;
    },
    get transitionStatus() {
      return panel.transitionStatus();
    },
  };

  const element = useRenderElement('div', omit(componentProps, 'style'), {
    state: panelState,
    ref: panel.ref,
    get props() {
      return [
        // An accessor source: its keys change with the panel's state without rebuilding these props.
        propsSourceAccessor(panel.props),
        {
          // The client writes measured sizes to these variables directly (see
          // `useCollapsiblePanel`); the server renders their initial `auto`.
          get style() {
            return isServer
              ? {
                  [CollapsiblePanelCssVars.collapsiblePanelHeight as string]: 'auto',
                  [CollapsiblePanelCssVars.collapsiblePanelWidth as string]: 'auto',
                }
              : undefined;
          },
        },
        elementProps,
        {
          get style() {
            return resolveStyle(local.style, panelState);
          },
        },
        // Resolve the public `style` prop so temporary `animationName: 'none'`
        // can still win after user's inline styles have been merged.
        {
          get style() {
            return panel.shouldPreventOpenAnimation() ? { 'animation-name': 'none' } : undefined;
          },
        },
      ];
    },
    stateAttributesMapping: collapsibleStateAttributesMapping,
  });

  return <Show when={panel.shouldRender()}>{element()}</Show>;
}

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['hiddenUntilFound', 'keepMounted', 'id']);
/** The temporary style that neutralizes an author-defined open animation. */
const ANIMATION_NONE: JSX.CSSProperties = { 'animation-name': 'none' };

/**
 * Warns in development when `keepMounted={false}` is ignored because `hiddenUntilFound` is set
 * (both read reactively, as the slow path's effect).
 */
export function warnKeepMountedIgnored(
  hiddenUntilFound: () => boolean | undefined,
  keepMounted: () => boolean | undefined,
  message: string,
) {
  createDepsEffect(
    () => ({ hiddenUntilFound: hiddenUntilFound(), keepMounted: keepMounted() }),
    (deps) => {
      if (deps.hiddenUntilFound && deps.keepMounted === false) {
        warn(message);
      }
    },
  );
}

function NativeCollapsiblePanel(props: CollapsiblePanel.Props): JSX.Element {
  const owner = getOwner();

  if (process.env.NODE_ENV !== 'production') {
    warnKeepMountedIgnored(
      () => props.hiddenUntilFound,
      () => props.keepMounted,
      'The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
    );
  }

  const {
    defaultPanelId,
    mounted,
    onOpenChange,
    open,
    setMounted,
    owner: rootOwner,
    setPanelIdState,
    setOpen,
    state,
    transitionStatus,
  } = useCollapsibleRootContext();

  const hiddenUntilFound = () => props.hiddenUntilFound ?? false;
  const keepMounted = () => props.keepMounted ?? false;
  const id = () => (props.id || undefined) ?? defaultPanelId();

  const registerId = createIdRegistration(props, 'id', setPanelIdState, rootOwner);

  // The measurement and transition machinery is created when the panel first renders (a closed
  // panel without `keepMounted` never does) and kept for the part's lifetime, owned by the part.
  const initialOpen = untrack(open);
  let panel: ReturnType<typeof useCollapsiblePanel> | undefined;
  const getPanel = () =>
    (panel ??= runWithOwner(owner, () =>
      untrack(() =>
        useCollapsiblePanel({
          dimensionCssVars: {
            height: CollapsiblePanelCssVars.collapsiblePanelHeight,
            width: CollapsiblePanelCssVars.collapsiblePanelWidth,
          },
          hiddenUntilFound,
          id,
          initialOpen,
          keepMounted,
          mounted,
          native: true,
          onOpenChange,
          open,
          setMounted,
          setOpen,
          transitionStatus,
        }),
      ),
    )!);

  const panelState: CollapsiblePanelState = {
    get open() {
      return state.open;
    },
    get disabled() {
      return state.disabled;
    },
    get transitionStatus() {
      return getPanel().transitionStatus();
    },
  };

  const shouldRender = () => keepMounted() || hiddenUntilFound() || mounted() || open();

  return createNativeConditional(owner, shouldRender, () =>
    renderNativePanel(
      props,
      panelState,
      getPanel(),
      id,
      collapsibleStateAttributesMapping,
      undefined,
      undefined,
      registerId,
    ),
  ) as unknown as JSX.Element;
}

/**
 * The panel element of a native Collapsible or Accordion panel: the hook's attributes
 * (`[data-starting-style]` persistence, `hidden`, `id`), the part's state attributes, the
 * consumer's props and the temporary `animation-name: none` above the consumer's style.
 */
export function renderNativePanel<State extends CollapsiblePanelState>(
  props: object,
  panelState: State,
  panel: ReturnType<typeof useCollapsiblePanel>,
  id: () => JSX.HTMLAttributes<Element>['id'],
  mapping: StateAttributesMapping<State>,
  literal?: Record<string, unknown>,
  attributes?: (set: SetAttribute) => void,
  registerId?: ((element: Element | null) => void) | undefined,
): JSX.Element {
  return renderNativeElement((<div />) as unknown as Element, props, {
    own: OWN_KEYS,
    state: panelState,
    mapping,
    reactive: true,
    literal,
    attributes: (set) => {
      if (panel.shouldPersistHiddenTransitionStyles()) {
        set(CollapsiblePanelDataAttributes.startingStyle, '');
      }
      set('hidden', panel.hiddenAttribute());
      set('id', id());
      attributes?.(set);
    },
    styleOverride: () => (panel.shouldPreventOpenAnimation() ? ANIMATION_NONE : undefined),
    refs: registerId ? [panel.ref, registerId] : [panel.ref],
  }) as unknown as JSX.Element;
}

export interface CollapsiblePanelState extends CollapsibleRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CollapsiblePanelProps extends BaseUIComponentProps<'div', CollapsiblePanelState> {
  /**
   * Allows the browser’s built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   *
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is hidden.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CollapsiblePanel {
  export type State = CollapsiblePanelState;
  export type Props = CollapsiblePanelProps;
}
