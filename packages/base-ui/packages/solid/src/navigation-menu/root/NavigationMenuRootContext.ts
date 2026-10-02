/* eslint-disable typescript/no-explicit-any -- generic value erased at context */
import { createContext, useContext } from 'solid-js';
import type { Accessor, Context, Setter } from 'solid-js';
import type { FloatingRootContext } from '../../floating-ui-solid';
import type { ReactLikeRef } from '../../solid-helpers';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import type { NavigationMenuRoot } from './NavigationMenuRoot';

export type NavigationMenuPopupAutoSizeResetState = {
  abortController: AbortController | null;
  owner: any;
};

export interface NavigationMenuRootContext<Value = any> {
  open: Accessor<boolean>;
  value: Accessor<NavigationMenuRoot.Value<Value>>;
  setValue: (
    value: NavigationMenuRoot.Value<Value>,
    eventDetails: NavigationMenuRoot.ChangeEventDetails,
  ) => void;
  transitionStatus: Accessor<TransitionStatus>;
  mounted: Accessor<boolean>;
  popupElement: Accessor<HTMLElement | null | undefined>;
  setPopupElement: Setter<HTMLElement | null | undefined>;
  positionerElement: Accessor<HTMLElement | null | undefined>;
  setPositionerElement: Setter<HTMLElement | null | undefined>;
  viewportElement: Accessor<HTMLElement | null | undefined>;
  setViewportElement: Setter<HTMLElement | null | undefined>;
  viewportTargetElement: Accessor<HTMLElement | null | undefined>;
  setViewportTargetElement: Setter<HTMLElement | null | undefined>;
  activationDirection: Accessor<'left' | 'right' | 'up' | 'down' | null>;
  setActivationDirection: Setter<'left' | 'right' | 'up' | 'down' | null>;
  floatingRootContext: Accessor<FloatingRootContext | undefined>;
  setFloatingRootContext: Setter<FloatingRootContext | undefined>;
  currentContentRef: ReactLikeRef<HTMLDivElement | null | undefined>;
  rootRef: ReactLikeRef<HTMLDivElement | null | undefined>;
  beforeInsideRef: ReactLikeRef<HTMLSpanElement | null | undefined>;
  afterInsideRef: ReactLikeRef<HTMLSpanElement | null | undefined>;
  beforeOutsideRef: ReactLikeRef<HTMLSpanElement | null | undefined>;
  afterOutsideRef: ReactLikeRef<HTMLSpanElement | null | undefined>;
  prevTriggerElementRef: ReactLikeRef<Element | null | undefined>;
  popupAutoSizeResetRef: ReactLikeRef<NavigationMenuPopupAutoSizeResetState>;
  nested: Accessor<boolean>;
  delay: Accessor<number>;
  closeDelay: Accessor<number>;
  orientation: Accessor<'horizontal' | 'vertical'>;
  viewportInert: Accessor<boolean>;
  setViewportInert: Setter<boolean>;
}

// Solid: `Context` has no `displayName` field; it is added for parity with React's dev label.
export const NavigationMenuRootContext: Context<NavigationMenuRootContext<any> | null> & {
  displayName?: string;
} = createContext<NavigationMenuRootContext<any> | null>(null);

if (process.env.NODE_ENV !== 'production') {
  NavigationMenuRootContext.displayName = 'NavigationMenuRootContext';
}

function useNavigationMenuRootContext<Value = any>(
  optional?: false,
): NavigationMenuRootContext<Value>;
function useNavigationMenuRootContext<Value = any>(
  optional: true,
): NavigationMenuRootContext<Value> | null;
function useNavigationMenuRootContext<Value = any>(optional?: boolean) {
  const context = useContext(NavigationMenuRootContext) as NavigationMenuRootContext<Value> | null;
  if (context == null && !optional) {
    throw new Error(
      'Base UI: NavigationMenuRootContext is missing. Navigation Menu parts must be placed within <NavigationMenu.Root>.',
    );
  }
  return context;
}

export const NavigationMenuTreeContext = createContext<Accessor<string | undefined> | null>(null);

function useNavigationMenuTreeContext() {
  return useContext(NavigationMenuTreeContext);
}

export { useNavigationMenuRootContext, useNavigationMenuTreeContext };
