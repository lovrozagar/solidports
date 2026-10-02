/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import {
  createTrackedEffect,
  createContext,
  createSignal,
  onCleanup,
  useContext,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { defaultProps, useRef, type ReactLikeRef } from '../../solid-helpers';
import {
  BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { useTimeout, type Timeout } from '../../utils/useTimeout';
import { getDelay } from '../hooks/useHoverShared';
import type { Delay, FloatingContext, FloatingRootContext } from '../types';

type CurrentContextRef = {
  onOpenChange: (open: boolean, eventDetails: BaseUIChangeEventDetails<any>) => void;
  setIsInstantPhase: (value: boolean) => void;
} | null;

interface ContextValue {
  hasProvider: boolean;
  timeoutMs: Accessor<number>;
  setTimeoutMs: (value: number) => void;
  delayRef: ReactLikeRef<Delay>;
  initialDelayRef: ReactLikeRef<Delay>;
  timeout: Timeout;
  currentIdRef: ReactLikeRef<any>;
  currentContextRef: ReactLikeRef<CurrentContextRef>;
}

const FloatingDelayGroupContext = createContext<ContextValue>({
  currentContextRef: { current: null },
  currentIdRef: { current: null },
  delayRef: { current: 0 },
  hasProvider: false,
  initialDelayRef: { current: 0 },
  setTimeoutMs: () => {},
  timeout: {
    clear: () => {},
    isStarted: () => false,
    start: () => {},
  },
  timeoutMs: () => 0,
});

export interface FloatingDelayGroupProps {
  children?: JSX.Element;
  /**
   * The delay to use for the group when it's not in the instant phase.
   */
  delay: Delay;
  /**
   * An optional explicit timeout to use for the group, which represents when
   * grouping logic will no longer be active after the close delay completes.
   * This is useful if you want grouping to “last” longer than the close delay,
   * for example if there is no close delay at all.
   */
  timeoutMs?: number | undefined;
}

/**
 * Experimental next version of `FloatingDelayGroup` to become the default
 * in the future. This component is not yet stable.
 * Provides context for a group of floating elements that should share a
 * `delay`. Unlike `FloatingDelayGroup`, `useDelayGroup` with this
 * component does not cause a re-render of unrelated consumers of the
 * context when the delay changes.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function FloatingDelayGroup(componentProps: FloatingDelayGroupProps): JSX.Element {
  const props = defaultProps(componentProps, { timeoutMs: 0 });
  const initialDelay = () => props.delay;

  const delayRef = useRef(initialDelay());
  const initialDelayRef = useRef(initialDelay());
  const currentIdRef = useRef<string | null>(null);
  const currentContextRef = useRef(null);
  const timeout = useTimeout();
  const [timeoutMs, setTimeoutMs] = createSignal(props.timeoutMs);

  return (
    <FloatingDelayGroupContext
      value={{
        currentContextRef,
        currentIdRef,
        delayRef,
        hasProvider: true,
        initialDelayRef,
        setTimeoutMs,
        timeout,
        timeoutMs,
      }}
    >
      {props.children}
    </FloatingDelayGroupContext>
  );
}

interface UseDelayGroupOptions {
  /**
   * Whether the trigger this hook is used in has opened the tooltip.
   */
  open: boolean;
}

interface UseDelayGroupReturn {
  /**
   * The delay reference object.
   */
  delayRef: ReactLikeRef<Delay>;
  /**
   * Whether animations should be removed.
   */
  isInstantPhase: Accessor<boolean>;
  /**
   * Whether a `<FloatingDelayGroup>` provider is present.
   */
  hasProvider: boolean;
}

/**
 * Enables grouping when called inside a component that's a child of a
 * `FloatingDelayGroup`.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function useDelayGroup(parameters: {
  context: FloatingRootContext | FloatingContext;
  options: UseDelayGroupOptions;
}): UseDelayGroupReturn {
  const options = defaultProps(parameters.options ?? {}, { open: false });
  const store = () =>
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context;
  const floatingId = () => store().state.floatingId;

  const {
    currentIdRef,
    currentContextRef,
    delayRef,
    timeoutMs,
    initialDelayRef,
    hasProvider,
    timeout,
  } = useContext(FloatingDelayGroupContext);

  const [isInstantPhase, setIsInstantPhase] = createSignal(false);

  function unset() {
    {
      setIsInstantPhase(false);
      currentContextRef?.current?.setIsInstantPhase(false);
      currentIdRef.current = null;
      currentContextRef.current = null;
      delayRef.current = initialDelayRef?.current;
    };
  }

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (!hasProvider) {
      return;
    }

    if (!currentIdRef.current) {
      return;
    }

    if (!options.open && currentIdRef.current === floatingId()) {
      setIsInstantPhase(false);

      if (timeoutMs()) {
        const closingId = floatingId();
        const fn = () => {
          // If another tooltip has taken over the group, skip resetting.
          if (store().state.open || (currentIdRef.current && currentIdRef.current !== closingId)) {
            return;
          }
          unset();
        };
        timeout.start(timeoutMs(), fn);
        _c.push(() => timeout.clear());
        return;
      }

      unset();
    }
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  createTrackedEffect(() => {
    if (!hasProvider) {
      return;
    }

    if (!options.open) {
      return;
    }

    const prevContext = currentContextRef.current;
    const prevId = currentIdRef.current;

    // A new tooltip is opening, so cancel any pending timeout that would reset
    // the group's delay back to the initial value.
    timeout.clear();
    currentContextRef.current = { onOpenChange: store().setOpen, setIsInstantPhase };
    currentIdRef.current = floatingId();
    delayRef.current = {
      close: getDelay(initialDelayRef.current, 'close'),
      open: 0,
    };

    if (prevId !== null && prevId !== floatingId()) {
      setIsInstantPhase(true);
      prevContext?.setIsInstantPhase(true);
      prevContext?.onOpenChange(false, createChangeEventDetails(REASONS.none));
    } else {
      setIsInstantPhase(false);
      prevContext?.setIsInstantPhase(false);
    }
  });

  onCleanup(() => {
    currentContextRef.current = null;
  });

  return {
    delayRef,
    hasProvider,
    isInstantPhase,
  };
}
