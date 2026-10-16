import { getOwner, omit, Show, untrack } from 'solid-js';
import type { Owner } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isServer } from '@solidjs/web';
import { createNativeConditional } from '../../utils/native/conditional';
import {
  renderNativePanel,
  warnKeepMountedIgnored,
} from '../../collapsible/panel/CollapsiblePanel';
import { useCollapsiblePanel } from '../../collapsible/panel/useCollapsiblePanel';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { panelRootParameters } from '../../collapsible/root/useCollapsibleRoot';
import { createDepsRenderEffect, isStaticProp, splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter } from '../../utils/native/element';
import { createIdRegistration } from '../../utils/native/registration';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceAccessor } from '../../utils/propsView';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { ITEM_STATE_KEYS } from '../item/AccordionItemModel';
import type { AccordionItemStateView } from '../item/AccordionItemModel';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import type { AccordionRoot } from '../root/AccordionRoot';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import * as AccordionPanelCssVars from './AccordionPanelCssVars';
import { runInLazyScope } from '../../utils/runInLazyScope';

const KEEP_MOUNTED_WARNING =
  'The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.';
const REGION: Record<string, unknown> = { role: 'region' };

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export function AccordionPanel(componentProps: AccordionPanel.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX; the panel's measurement machinery is created when the panel first renders.
  if (canRenderNative(componentProps, undefined, true)) {
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
    return NativeAccordionPanel(componentProps);
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'hiddenUntilFound',
    'keepMounted',
    'id',
    'style',
  ]);

  const { hiddenUntilFound: contextHiddenUntilFound, keepMounted: contextKeepMounted } =
    useAccordionRootContext();

  const root = useCollapsibleRootContext();

  const hiddenUntilFound = () => local.hiddenUntilFound ?? contextHiddenUntilFound();
  const keepMounted = () => local.keepMounted ?? contextKeepMounted();
  const registeredId = () => local.id || undefined;
  const id = () => local.id ?? root.defaultPanelId();

  if (process.env.NODE_ENV !== 'production') {
    warnKeepMountedIgnored(hiddenUntilFound, () => local.keepMounted, KEEP_MOUNTED_WARNING);
  }

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
      height: AccordionPanelCssVars.accordionPanelHeight,
      width: AccordionPanelCssVars.accordionPanelWidth,
    },
    hiddenUntilFound,
    id,
    keepMounted,
    ...panelRootParameters(root),
  });

  const item = useAccordionItemContext();
  const { state } = item;

  const panelState: AccordionPanelState = {
    get value() {
      return state.value;
    },
    get disabled() {
      return state.disabled;
    },
    get orientation() {
      return state.orientation;
    },
    get hidden() {
      return state.hidden;
    },
    get index() {
      return state.index;
    },
    get open() {
      return state.open;
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
        {
          get 'aria-labelledby'() {
            return item.triggerId();
          },
          role: 'region',
          // The client writes measured sizes to these variables directly (see
          // `useCollapsiblePanel`); the server renders their initial `auto`.
          get style() {
            return isServer
              ? {
                  [AccordionPanelCssVars.accordionPanelHeight as string]: 'auto',
                  [AccordionPanelCssVars.accordionPanelWidth as string]: 'auto',
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
    stateAttributesMapping: accordionStateAttributesMapping,
  });

  return <Show when={panel.shouldRender()}>{element()}</Show>;
}

/** The panel's state attributes, compiled once: the item's keys, then the transition status. */
const writePanelState = compileStateWriter(
  [...ITEM_STATE_KEYS, 'transitionStatus'],
  accordionStateAttributesMapping,
);

function NativeAccordionPanel(props: AccordionPanel.Props): JSX.Element {
  const owner = getOwner();
  const accordionRoot = useAccordionRootContext();
  const root = useCollapsibleRootContext();
  const item = useAccordionItemContext();

  const hiddenUntilFound = () => props.hiddenUntilFound ?? accordionRoot.hiddenUntilFound();
  const keepMounted = () => props.keepMounted ?? accordionRoot.keepMounted();

  if (process.env.NODE_ENV !== 'production') {
    // The warning needs the panel's own `keepMounted={false}`: when that prop is static and not
    // `false`, it can never fire, whatever `hiddenUntilFound` becomes.
    warnKeepMountedIgnored(
      hiddenUntilFound,
      () => props.keepMounted,
      KEEP_MOUNTED_WARNING,
      !isStaticProp(props, 'keepMounted') || untrack(() => props.keepMounted) === false,
    );
  }

  const registerId = createIdRegistration(props, 'id', root.setPanelIdState, root.owner);

  // A closed panel without `keepMounted` never renders: it allocates only this condition. The
  // measurement and transition machinery and the panel's state are created when the panel first
  // renders and kept for the part's lifetime, owned by the part.
  const initialOpen = untrack(() => root.open());
  const shouldRender = () => keepMounted() || hiddenUntilFound() || root.mounted() || root.open();
  let rendered: ReturnType<typeof createRenderedPanel> | undefined;

  return createNativeConditional(owner, shouldRender, () => {
    rendered ??= createRenderedPanel(props, root, item, owner, initialOpen, hiddenUntilFound, keepMounted);
    const panel = rendered;
    return renderNativePanel(
      props,
      () => panel.state,
      panel.panel,
      panel.id,
      accordionStateAttributesMapping,
      REGION,
      (set) => set('aria-labelledby', item.triggerId()),
      registerId,
      writePanelState,
      panel.view,
    );
  }) as unknown as JSX.Element;
}

type CollapsiblePanelHook = ReturnType<typeof useCollapsiblePanel>;

/** A panel's state keys as prototype getters, for `writePanelState`. */
class AccordionPanelStateView {
  declare private readonly item: AccordionItemStateView;
  declare private readonly panel: CollapsiblePanelHook;

  constructor(item: AccordionItemStateView, panel: CollapsiblePanelHook) {
    this.item = item;
    this.panel = panel;
  }

  get value() {
    return this.item.value;
  }

  get orientation() {
    return this.item.orientation;
  }

  get hidden() {
    return this.item.hidden;
  }

  get index() {
    return this.item.index;
  }

  get disabled() {
    return this.item.disabled;
  }

  get open() {
    return this.item.open;
  }

  get transitionStatus() {
    return this.panel.transitionStatus();
  }
}

/** The machinery, ids and state of a panel that renders, created on its first render. */
function createRenderedPanel(
  props: AccordionPanel.Props,
  root: ReturnType<typeof useCollapsibleRootContext>,
  item: ReturnType<typeof useAccordionItemContext>,
  owner: Owner | null,
  initialOpen: boolean,
  hiddenUntilFound: () => boolean,
  keepMounted: () => boolean,
) {
  const id = () => props.id ?? root.defaultPanelId();
  const panel = runInLazyScope(owner, () =>
    untrack(() =>
      useCollapsiblePanel({
        dimensionCssVars: {
          height: AccordionPanelCssVars.accordionPanelHeight,
          width: AccordionPanelCssVars.accordionPanelWidth,
        },
        hiddenUntilFound,
        id,
        initialOpen,
        keepMounted,
        native: true,
        ...panelRootParameters(root),
      }),
    ),
  )!;
  let publicState: AccordionPanelState | undefined;
  return {
    id,
    panel,
    view: new AccordionPanelStateView(item.stateView, panel),
    get state(): AccordionPanelState {
      publicState ??= createPanelState(item.state, panel);
      return publicState;
    },
  };
}

/** The public panel state: the item's state and the transition status, as own getters. */
function createPanelState(state: AccordionItemState, panel: CollapsiblePanelHook): AccordionPanelState {
  return {
    get value() {
      return state.value;
    },
    get disabled() {
      return state.disabled;
    },
    get orientation() {
      return state.orientation;
    },
    get hidden() {
      return state.hidden;
    },
    get index() {
      return state.index;
    },
    get open() {
      return state.open;
    },
    get transitionStatus() {
      return panel.transitionStatus();
    },
  };
}

export interface AccordionPanelState extends AccordionItemState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AccordionPanelProps
  extends
    BaseUIComponentProps<'div', AccordionPanelState>,
    Pick<AccordionRoot.Props, 'hiddenUntilFound' | 'keepMounted'> {}

export namespace AccordionPanel {
  export type State = AccordionPanelState;
  export type Props = AccordionPanelProps;
}
