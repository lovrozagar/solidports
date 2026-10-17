import { getOwner, omit, Show, untrack } from 'solid-js';
import type { Owner } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isServer } from '@solidjs/web';
import { createNativeConditional } from '../../utils/native/conditional';
import {
  createDepsEffect,
  createDepsRenderEffect,
  isStaticProp,
  splitComponentProps,
} from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceAccessor } from '../../utils/propsView';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { warn } from '../../utils/warn';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import { panelRootParameters } from '../root/useCollapsibleRoot';
import type { CollapsibleRootState } from '../root/CollapsibleRoot';
import {
  collapsibleStateAttributesMapping,
  writeCollapsibleState,
} from '../root/stateAttributesMapping';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { SetAttribute, StateWriter } from '../../utils/native/element';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { createIdRegistration } from '../../utils/native/registration';
import { DeferredPanel, ServerPanel, useCollapsiblePanel } from './useCollapsiblePanel';
import * as CollapsiblePanelCssVars from './CollapsiblePanelCssVars';
import * as CollapsiblePanelDataAttributes from './CollapsiblePanelDataAttributes';
import { runInLazyScope } from '../../utils/runInLazyScope';

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export function CollapsiblePanel(componentProps: CollapsiblePanel.Props) {
  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX; the panel's measurement machinery is created when the panel first renders.
  if (canRenderNative(componentProps, undefined, true)) {
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
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

  const root = useCollapsibleRootContext();

  const hiddenUntilFound = () => local.hiddenUntilFound ?? false;
  const keepMounted = () => local.keepMounted ?? false;
  const registeredId = () => local.id || undefined;
  const id = () => registeredId() ?? root.defaultPanelId();

  createDepsRenderEffect(registeredId, (currentRegisteredId) => {
    root.setPanelIdState(
      (currentId) => currentRegisteredId ?? (currentId === null ? undefined : currentId),
    );
    return () => {
      root.setPanelIdState((currentId) => (currentId === currentRegisteredId ? null : currentId));
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
    ...panelRootParameters(root),
  });

  const rootState = root.state;
  const panelState: CollapsiblePanelState = {
    get open() {
      return rootState.open;
    },
    get disabled() {
      return rootState.disabled;
    },
    get transitionStatus() {
      return panel.transitionStatus();
    },
  };

  // An accessor source: its keys change with the panel's state without rebuilding the props. Made
  // once, so reading the props (an effect re-syncing refs, say) creates no memo.
  const panelProps = propsSourceAccessor(panel.props);
  const element = useRenderElement('div', omit(componentProps, 'style'), {
    state: panelState,
    ref: panel.ref,
    get props() {
      return [
        panelProps,
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
        // The variables at `auto`, on the server and the client alike (D9), last as the native
        // panel writes them: the client writes measured sizes over them directly (see
        // `useCollapsiblePanel`), and an unchanged `auto` writes nothing, so a measured size stays.
        // Rendering them on the client too keeps the server's after hydration, which removes what
        // the client does not render.
        { style: panel.dimensionStyle },
      ];
    },
    stateAttributesMapping: collapsibleStateAttributesMapping,
  });

  return <Show when={panel.shouldRender()}>{element()}</Show>;
}

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['hiddenUntilFound', 'keepMounted', 'id']);
/** The panel's element: a `<div>`. */
const PANEL_DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
const withoutAnimation = new WeakMap<JSX.CSSProperties, JSX.CSSProperties>();

/**
 * The temporary style that neutralizes an author-defined open animation, followed by
 * `dimensions`: one shared object per dimension style.
 */
function withAnimationNone(dimensions: JSX.CSSProperties): JSX.CSSProperties {
  let style = withoutAnimation.get(dimensions);
  if (!style) {
    style = { 'animation-name': 'none', ...dimensions };
    withoutAnimation.set(dimensions, style);
  }
  return style;
}

/**
 * Warns in development when `keepMounted={false}` is ignored because `hiddenUntilFound` is set, on
 * mount and whenever either changes, as upstream's effect. With `reactive: false` (both inputs are
 * static props) there is nothing to re-check, so it checks once at setup and creates no node.
 */
export function warnKeepMountedIgnored(
  hiddenUntilFound: () => boolean | undefined,
  keepMounted: () => boolean | undefined,
  message: string,
  reactive = true,
) {
  if (!reactive) {
    if (untrack(hiddenUntilFound) && untrack(keepMounted) === false) {
      warn(message);
    }
    return;
  }
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
      !isStaticProp(props, 'hiddenUntilFound') || !isStaticProp(props, 'keepMounted'),
    );
  }

  const root = useCollapsibleRootContext();
  const registerId = createIdRegistration(props, 'id', root.setPanelIdState, root.owner);
  const initialOpen = untrack(() => root.open());
  // A closed panel without `keepMounted` never renders: it allocates only this condition. The
  // measurement and transition machinery and the panel's state are created when the panel first
  // renders and kept for the part's lifetime, owned by the part.
  const shouldRender = () =>
    Boolean(props.keepMounted || props.hiddenUntilFound) || root.mounted() || root.open();
  let rendered: ReturnType<typeof createRenderedPanel> | undefined;

  return createNativeConditional(owner, shouldRender, () => {
    rendered ??= createRenderedPanel(props, root, owner, initialOpen);
    const panel = rendered;
    return renderNativePanel(
      props,
      () => panel.state,
      panel.panel,
      panel.id,
      collapsibleStateAttributesMapping,
      undefined,
      undefined,
      registerId,
      writeCollapsibleState,
      panel.view,
    );
  }) as unknown as JSX.Element;
}

/** A native panel's machinery and state, created on its first render. */
type PanelHook = ReturnType<typeof useCollapsiblePanel>;

/** A panel's state keys as prototype getters, for `writeCollapsibleState`. */
class CollapsiblePanelStateView {
  declare private readonly root: ReturnType<typeof useCollapsibleRootContext>;
  declare private readonly panel: PanelHook;

  constructor(root: ReturnType<typeof useCollapsibleRootContext>, panel: PanelHook) {
    this.root = root;
    this.panel = panel;
  }

  get open() {
    return this.root.open();
  }

  get disabled() {
    return this.root.disabled();
  }

  get transitionStatus() {
    return this.panel.transitionStatus();
  }
}

/** The panel's dimension variables. */
const PANEL_DIMENSIONS = {
  height: CollapsiblePanelCssVars.collapsiblePanelHeight,
  width: CollapsiblePanelCssVars.collapsiblePanelWidth,
};

function createRenderedPanel(
  props: CollapsiblePanel.Props,
  root: ReturnType<typeof useCollapsibleRootContext>,
  owner: Owner | null,
  initialOpen: boolean,
) {
  const hiddenUntilFound = () => props.hiddenUntilFound ?? false;
  const keepMounted = () => props.keepMounted ?? false;
  const id = () => (props.id || undefined) ?? root.defaultPanelId();
  // The server's panel creates no reactive node (D9), so it needs no lazy scope.
  const createPanel = () =>
    runInLazyScope(owner, () =>
      untrack(() =>
        useCollapsiblePanel({
          dimensionCssVars: PANEL_DIMENSIONS,
          hiddenUntilFound,
          id,
          initialOpen,
          keepMounted,
          native: true,
          ...panelRootParameters(root),
        }),
      ),
    )!;
  // A panel open since its part was created (a page that renders it open, hydrated or not) builds
  // its client machinery on its first state change, which may never come: until then it suppresses
  // the open animation, as the machinery would. A panel that opens later animates that opening, and
  // one that renders closed (`keepMounted`, `hiddenUntilFound`) needs its `beforematch` listener
  // and the next open's measurement: both build it at once.
  let panel: ReturnType<typeof useCollapsiblePanel>;
  if (isServer) {
    panel = new ServerPanel(root, hiddenUntilFound, keepMounted, PANEL_DIMENSIONS, initialOpen);
  } else if (initialOpen && untrack(() => root.open())) {
    panel = new DeferredPanel(root, hiddenUntilFound, keepMounted, PANEL_DIMENSIONS, createPanel);
  } else {
    panel = createPanel();
  }
  let publicState: CollapsiblePanelState | undefined;
  return {
    id,
    panel,
    view: new CollapsiblePanelStateView(root, panel),
    get state(): CollapsiblePanelState {
      publicState ??= createPanelState(root.state, panel);
      return publicState;
    },
  };
}

/** The public panel state, as consumer functions and render props receive it. */
function createPanelState(
  rootState: CollapsibleRootState,
  panel: PanelHook,
): CollapsiblePanelState {
  return {
    get open() {
      return rootState.open;
    },
    get disabled() {
      return rootState.disabled;
    },
    get transitionStatus() {
      return panel.transitionStatus();
    },
  };
}

/**
 * The panel element of a native Collapsible or Accordion panel: the hook's attributes
 * (`[data-starting-style]` persistence, `hidden`, `id`), the part's state attributes, the
 * consumer's props and the temporary `animation-name: none` above the consumer's style.
 */
export function renderNativePanel<State extends CollapsiblePanelState>(
  props: object,
  panelState: State | (() => State),
  panel: ReturnType<typeof useCollapsiblePanel>,
  id: () => JSX.HTMLAttributes<Element>['id'],
  mapping: StateAttributesMapping<State>,
  literal?: Record<string, unknown>,
  attributes?: (set: SetAttribute) => void,
  registerId?: ((element: Element | null) => void) | undefined,
  stateWriter?: StateWriter | undefined,
  stateView?: object | undefined,
): JSX.Element {
  return renderNativeElement(PANEL_DIV, props, {
    own: OWN_KEYS,
    state: panelState,
    mapping,
    stateWriter,
    stateView,
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
    // The suppressed open animation, then the unmeasured dimension variables, on the server and in
    // the client's first render (D9), above the consumer's style: the client writes the measured
    // sizes over them, as the slow path's panel writes its variables after the consumer's style.
    styleOverride: () =>
      panel.shouldPreventOpenAnimation()
        ? withAnimationNone(panel.dimensionStyle)
        : panel.dimensionStyle,
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
   * Allows the browser's built-in page search to find and expand the panel contents.
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
