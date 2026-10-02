import { untrack } from 'solid-js';

type EventTargetWithListeners = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

type KnownEventTarget =
  | AbortSignal
  | Document
  | Element
  | HTMLElement
  | MediaQueryList
  | SVGElement
  | VisualViewport
  | Window;

type EventMap<Target> = Target extends Window
  ? WindowEventMap
  : Target extends Document
    ? DocumentEventMap
    : Target extends MediaQueryList
      ? MediaQueryListEventMap
      : Target extends VisualViewport
        ? VisualViewportEventMap
        : Target extends SVGElement
          ? SVGElementEventMap
          : Target extends HTMLElement
            ? HTMLElementEventMap
            : Target extends Element
              ? ElementEventMap & GlobalEventHandlersEventMap
              : Target extends AbortSignal
                ? AbortSignalEventMap
                : never;

type TypedEventListener<Target, Event> =
  { handleEvent(event: Event): void } | ((this: Target, event: Event) => void);

/**
 * Adds an event listener and returns a cleanup function to remove it.
 * The listener runs untracked: an event can fire synchronously inside an effect callback (e.g.
 * `focus()` dispatching `focusout`), and a listener's reads are never subscriptions.
 */
export function addEventListener<
  Target extends KnownEventTarget,
  Type extends keyof EventMap<Target>,
>(
  target: Target,
  type: Type,
  listener: TypedEventListener<Target, EventMap<Target>[Type]>,
  options?: boolean | AddEventListenerOptions,
): () => void;
export function addEventListener(
  target: EventTargetWithListeners,
  type: string,
  listener: EventListenerOrEventListenerObject | ((event: any) => void),
  options?: boolean | AddEventListenerOptions,
): () => void;
export function addEventListener(
  target: EventTargetWithListeners,
  type: string,
  listener: EventListenerOrEventListenerObject | ((event: any) => void),
  options?: boolean | AddEventListenerOptions,
) {
  const untrackedListener = (event: Event) =>
    untrack(() =>
      typeof listener === 'function'
        ? (listener as (event: Event) => void).call(target, event)
        : listener.handleEvent(event),
    );
  target.addEventListener(type, untrackedListener, options);
  return () => {
    target.removeEventListener(type, untrackedListener, options);
  };
}
