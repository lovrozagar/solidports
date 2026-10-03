import { omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useCollapsiblePanel } from '../../collapsible/panel/useCollapsiblePanel';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { createDepsEffect, createDepsRenderEffect, splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { isServer } from '@solidjs/web';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { warn } from '../../utils/warn';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import type { AccordionRoot } from '../root/AccordionRoot';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import { AccordionPanelCssVars } from './AccordionPanelCssVars';

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export function AccordionPanel(componentProps: AccordionPanel.Props): JSX.Element {
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
    createDepsEffect(
      () => ({ hiddenUntilFound: hiddenUntilFound(), keepMounted: local.keepMounted }),
      (deps) => {
        if (deps.keepMounted === false && deps.hiddenUntilFound) {
          warn(
            'The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.',
          );
        }
      },
    );
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
        panel.props(),
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
