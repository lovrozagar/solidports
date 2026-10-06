import { getOwner, omit, runWithOwner, Show, untrack } from 'solid-js';
import { createNativeConditional } from '../../utils/native/conditional';
import type { JSX } from '@solidjs/web';
import {
  renderNativePanel,
  warnKeepMountedIgnored,
} from '../../collapsible/panel/CollapsiblePanel';
import { useCollapsiblePanel } from '../../collapsible/panel/useCollapsiblePanel';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { createDepsRenderEffect, splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { isServer } from '@solidjs/web';
import { canRenderNative } from '../../utils/native';
import { createIdRegistration } from '../../utils/native/registration';
import { useRenderElement } from '../../utils/useRenderElement';
import { propsSourceAccessor } from '../../utils/propsView';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import type { AccordionRoot } from '../root/AccordionRoot';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import { AccordionPanelCssVars } from './AccordionPanelCssVars';

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
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a `<div>` rendered with direct
  // JSX; the panel's measurement machinery is created when the panel first renders.
  if (canRenderNative(componentProps)) {
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

  const {
    defaultPanelId,
    mounted,
    onOpenChange,
    open,
    setMounted,
    setOpen,
    setPanelIdState,
    transitionStatus,
  } = useCollapsibleRootContext();

  const hiddenUntilFound = () => local.hiddenUntilFound ?? contextHiddenUntilFound();
  const keepMounted = () => local.keepMounted ?? contextKeepMounted();
  const registeredId = () => local.id || undefined;
  const id = () => local.id ?? defaultPanelId();

  if (process.env.NODE_ENV !== 'production') {
    warnKeepMountedIgnored(hiddenUntilFound, () => local.keepMounted, KEEP_MOUNTED_WARNING);
  }

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
      height: AccordionPanelCssVars.accordionPanelHeight,
      width: AccordionPanelCssVars.accordionPanelWidth,
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

  const { state, triggerId } = useAccordionItemContext();

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

  const element = useRenderElement('div', omit(componentProps, 'style'), {
    state: panelState,
    ref: panel.ref,
    get props() {
      return [
        // An accessor source: its keys change with the panel's state without rebuilding these props.
        propsSourceAccessor(panel.props),
        {
          get 'aria-labelledby'() {
            return triggerId?.();
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

function NativeAccordionPanel(props: AccordionPanel.Props): JSX.Element {
  const owner = getOwner();

  const { hiddenUntilFound: contextHiddenUntilFound, keepMounted: contextKeepMounted } =
    useAccordionRootContext();

  const {
    defaultPanelId,
    mounted,
    onOpenChange,
    open,
    owner: rootOwner,
    setMounted,
    setOpen,
    setPanelIdState,
    transitionStatus,
  } = useCollapsibleRootContext();

  const { state, triggerId } = useAccordionItemContext();

  const hiddenUntilFound = () => props.hiddenUntilFound ?? contextHiddenUntilFound();
  const keepMounted = () => props.keepMounted ?? contextKeepMounted();
  const id = () => props.id ?? defaultPanelId();

  if (process.env.NODE_ENV !== 'production') {
    warnKeepMountedIgnored(hiddenUntilFound, () => props.keepMounted, KEEP_MOUNTED_WARNING);
  }

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
            height: AccordionPanelCssVars.accordionPanelHeight,
            width: AccordionPanelCssVars.accordionPanelWidth,
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
      accordionStateAttributesMapping,
      REGION,
      (set) => set('aria-labelledby', triggerId?.()),
      registerId,
    ),
  ) as unknown as JSX.Element;
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
