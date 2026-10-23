/*
 * `useButton`'s keyboard logic for a native `<button>` that is a composite item, for native parts
 * that inline `useButton` (Tabs.Tab, NavigationMenu.Trigger): Space activates the item on keydown
 * so the composite root's navigation and the click stay in order, and its keyup is cancelled.
 */
import { untrack } from 'solid-js';
import { makeEventPreventable } from '../../merge-props/mergeProps';
import { dispatchClickWithModifiers } from '../dispatchClickWithModifiers';
import type { BaseUIEvent } from '../types';
import { readHandler } from './consumer';
import type { Dispatch } from './consumer';

/**
 * `handleKeyDownAfterConsumer` for a composite native button: Space dispatches the click on
 * keydown. Enter is left to the browser.
 */
export function compositeButtonKeyDownAfterConsumer(event: BaseUIEvent<KeyboardEvent>) {
  if (event.baseUIHandlerPrevented || event.target !== event.currentTarget || event.key !== ' ') {
    return;
  }
  event.preventDefault();
  event.preventBaseUIHandler();
  dispatchClickWithModifiers(event.currentTarget as Element, event);
}

/**
 * `handleKeyUpAfterConsumer`: a composite native button cancels Space's keyup activation (the
 * keydown already dispatched the click), before and regardless of `preventBaseUIHandler`.
 */
function compositeButtonKeyUpAfterConsumer(event: BaseUIEvent<KeyboardEvent>) {
  if (event.target === event.currentTarget && event.key === ' ') {
    event.preventDefault();
  }
}

/**
 * `useButton`'s composite keyup as a module-level handler: a disabled button runs nothing; else the
 * consumer's handler, then the Space cancel, which runs even when the consumer prevented the Base
 * UI handler, so it sits outside `partHandler`'s gate.
 */
export function compositeButtonKeyUp<Target>(
  isDisabled: (target: Target) => boolean,
): Dispatch<Target> {
  return (record, nativeEvent) => {
    const event = makeEventPreventable(nativeEvent as BaseUIEvent<KeyboardEvent>);
    return untrack(() => {
      if (isDisabled(record.target)) {
        return undefined;
      }
      const consumer = readHandler(record.props, 'onKeyUp');
      const result = consumer ? consumer(event) : undefined;
      compositeButtonKeyUpAfterConsumer(event);
      return result;
    });
  };
}
