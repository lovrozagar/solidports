/* eslint-disable typescript/no-explicit-any -- Solid `JSX.EventHandlerUnion` requires casts to bridge native Event to Solid's currentTarget-augmented event shape; BaseUIEvent extension fields also need any-casts at handler boundaries */
import { isHTMLElement } from '@floating-ui/utils/dom';
import { createEffect, untrack } from 'solid-js';
import type { ComponentProps, JSX } from '@solidjs/web';
import { useCompositeRootContext } from '../composite/root/CompositeRootContext';
import { makeEventPreventable } from '../../merge-props';
import { mergeProps } from '../../merge-props/mergeProps';
import { access, callEventHandler, type MaybeAccessor } from '../../solid-helpers';
import { error } from '../../utils/error';
import type { BaseUIEvent } from '../../utils/types';
import { HTMLProps } from '../../utils/types';
import { useFocusableWhenDisabled } from '../../utils/useFocusableWhenDisabled';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { splitProps } from '../../solid-1-compat';

export function useButton(parameters: useButton.Parameters = {}): useButton.ReturnValue {
  const disabled = () => Boolean(access(parameters.disabled));
  const tabIndex = () => access(parameters.tabIndex) ?? 0;
  const isNativeButton = () => Boolean(access(parameters.native) ?? true);
  // Passed through as React does: `undefined` lets composite items stay focusable when disabled.
  const focusableWhenDisabled = () => {
    const value = access(parameters.focusableWhenDisabled);
    return value === '' ? true : value;
  };

  let elementRef: HTMLElement | null | undefined;

  // Capture at hook time: Solid 2 applies refs with a null owner (`runWithOwner(null)`),
  // so calling useContext from buttonRef → updateDisabled would throw NoOwnerError.
  const compositeRootContext = useCompositeRootContext(true);
  const isCompositeItem = () => access(parameters.composite) ?? compositeRootContext != null;

  const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
    composite: isCompositeItem,
    disabled,
    focusableWhenDisabled,
    isNativeButton,
    tabIndex,
  });

  if (process.env.NODE_ENV !== 'production') {
    createEffect(isNativeButton, (nativeButton) => {
      if (!elementRef) {
        return;
      }

      const isButtonTag = elementRef.tagName === 'BUTTON';

      if (nativeButton) {
        if (!isButtonTag) {
          error(
            'A component that acts as a button expected a native <button> because the ' +
              '`nativeButton` prop is true. Rendering a non-<button> removes native button ' +
              'semantics, which can impact forms and accessibility. Use a real <button> in the ' +
              '`render` prop, or set `nativeButton` to `false`.',
          );
        }
      } else if (isButtonTag) {
        error(
          'A component that acts as a button expected a non-<button> because the `nativeButton` ' +
            'prop is false. Rendering a <button> keeps native behavior while Base UI applies ' +
            'non-native attributes and handlers, which can add unintended extra attributes (such ' +
            'as `role` or `aria-disabled`). Use a non-<button> in the `render` prop, or set ' +
            '`nativeButton` to `true`.',
        );
      }
    });
  }

  // Runs from the ref callback and an effect apply: reads the latest values without subscribing.
  const updateDisabled = () =>
    untrack(() => {
      if (!isButtonElement(elementRef)) {
        return;
      }

      if (
        isCompositeItem() &&
        disabled() &&
        focusableWhenDisabledProps().disabled === undefined &&
        elementRef.disabled
      ) {
        elementRef.disabled = false;
      }
    });

  // handles a disabled composite button rendering another button, e.g.
  // <Toolbar.Button disabled render={() => <Menu.Trigger />} />
  // the `disabled` prop needs to pass through 2 `useButton`s then finally
  // delete the `disabled` attribute from DOM
  createEffect(
    () => [disabled(), focusableWhenDisabledProps().disabled, isCompositeItem()] as const,
    () => {
      untrack(updateDisabled);
    },
  );

  // TODO: fix typing in the whole function
  function getButtonProps(externalProps: GenericButtonProps = {}) {
    // Access event handlers directly instead of using splitProps, since externalProps
    // might be a proxy from combineProps and splitProps may not extract merged
    // callbacks correctly
    const externalOnClick = externalProps.onClick;
    const externalOnMouseDown = externalProps.onMouseDown;
    const externalOnKeyUp = externalProps.onKeyUp;
    const externalOnKeyDown = externalProps.onKeyDown;
    const externalOnPointerDown = externalProps.onPointerDown;

    const [, otherExternalProps] = splitProps(externalProps, [
      'onClick',
      'onMouseDown',
      'onKeyUp',
      'onKeyDown',
      'onPointerDown',
    ]);

    return mergeProps<'button'>(
      {
        onClick(event) {
          if (disabled()) {
            event.preventDefault();
            return;
          }
          callEventHandler(externalOnClick, event);
        },
        onKeyDown(event) {
          if (disabled()) {
            return;
          }

          makeEventPreventable(event);
          callEventHandler(externalOnKeyDown, event);
          const baseUIEvent = event as BaseUIEvent<KeyboardEvent>;
          if (baseUIEvent.baseUIHandlerPrevented) {
            return;
          }

          const isCurrentTarget = event.target === event.currentTarget;
          const currentTarget = event.currentTarget as Element;
          const isButton = isButtonElement(currentTarget);
          const isLink = !isNativeButton() && isValidLinkElement(currentTarget);
          const shouldClick = isCurrentTarget && (isNativeButton() ? isButton : !isLink);
          const isEnterKey = event.key === 'Enter';
          const isSpaceKey = event.key === ' ';
          const role = currentTarget.getAttribute('role');
          const isTextNavigationRole =
            role?.startsWith('menuitem') || role === 'option' || role === 'gridcell';

          if (isCurrentTarget && isCompositeItem() && isSpaceKey) {
            if (event.defaultPrevented && isTextNavigationRole) {
              return;
            }

            event.preventDefault();

            // Only a native-mode item that isn't a real <button> is excluded.
            if (!isNativeButton() || isButton) {
              baseUIEvent.preventBaseUIHandler();
              dispatchClickWithModifiers(currentTarget, event);
            }

            return;
          }

          // Keyboard accessibility for native and non-native elements.
          if (!shouldClick || isNativeButton() || (!isSpaceKey && !isEnterKey)) {
            // Space activates links on keyup (`role="button"` semantics, matching the
            // composite path); prevent the page scroll Space would otherwise trigger.
            // Enter is left to the browser's native link activation.
            if (isCurrentTarget && isLink && isSpaceKey) {
              event.preventDefault();
            }
            return;
          }

          // Match native buttons: preventing the keydown's default cancels activation.
          if (event.defaultPrevented) {
            return;
          }

          event.preventDefault();

          if (isEnterKey) {
            baseUIEvent.preventBaseUIHandler();
            dispatchClickWithModifiers(currentTarget, event);
          }
        },
        onKeyUp(event) {
          if (disabled()) {
            return;
          }

          // calling preventDefault in keyUp on a <button> will not dispatch a click event if Space is pressed
          // https://codesandbox.io/p/sandbox/button-keyup-preventdefault-dn7f0
          makeEventPreventable(event);
          callEventHandler(externalOnKeyUp, event);
          const baseUIEvent = event as BaseUIEvent<KeyboardEvent>;

          if (
            event.target === event.currentTarget &&
            isNativeButton() &&
            isCompositeItem() &&
            isButtonElement(event.currentTarget as HTMLElement) &&
            event.key === ' '
          ) {
            event.preventDefault();
            return;
          }

          if (baseUIEvent.baseUIHandlerPrevented) {
            return;
          }

          // Keyboard accessibility for non interactive elements.
          // Match native buttons: preventing the keyup's default cancels Space activation.
          // Limitation: unlike a native <button>, a prevented *keydown* cannot cancel the
          // activation — no state is kept between keydown and keyup, so we can't tell
          // whether the keydown was prevented or even happened on this element.
          if (
            event.target === event.currentTarget &&
            !isNativeButton() &&
            !isCompositeItem() &&
            !event.defaultPrevented &&
            event.key === ' '
          ) {
            baseUIEvent.preventBaseUIHandler();
            dispatchClickWithModifiers(event.currentTarget as Element, event);
          }
        },
        onMouseDown(event) {
          if (!disabled()) {
            callEventHandler(externalOnMouseDown, event);
          }
        },
        onPointerDown(event) {
          if (disabled()) {
            event.preventDefault();
            return;
          }
          callEventHandler(externalOnPointerDown, event);
        },
      },
      // Read when the props are resolved, as React does per render; `role` is resolved last below
      // because a later `undefined` overrides an earlier value in Solid.
      untrack(isNativeButton) ? { type: 'button' } : {},
      focusableWhenDisabledProps(),
      otherExternalProps,
      {
        get role() {
          if (otherExternalProps.role) {
            return otherExternalProps.role;
          }
          return !isNativeButton() ? 'button' : undefined;
        },
      },
    );
  }

  return {
    buttonRef: (value) => {
      elementRef = value;
      updateDisabled();
    },
    getButtonProps,
  };
}

function isButtonElement(elem: Element | null | undefined): elem is HTMLButtonElement {
  return isHTMLElement(elem) && elem.tagName === 'BUTTON';
}

function isValidLinkElement(elem: Element | null | undefined): elem is HTMLAnchorElement {
  return isHTMLElement(elem) && elem.tagName === 'A' && Boolean((elem as HTMLAnchorElement).href);
}

interface GenericButtonProps extends HTMLProps, AdditionalButtonProps {
  tabIndex?: number | undefined;
}

interface AdditionalButtonProps extends Partial<{
  'aria-disabled': JSX.AriaAttributes['aria-disabled'];
  disabled: boolean;
  role: JSX.AriaAttributes['role'];
  tabIndex?: number | undefined;
}> {}

export interface UseButtonParameters {
  /**
   * Whether the button is part of a composite widget.
   * When `true`, keyboard activation for Space occurs on keydown rather than keyup.
   * @default inferred from CompositeRoot context
   */
  composite?: MaybeAccessor<boolean | undefined>;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: MaybeAccessor<boolean | '' | undefined>;
  /**
   * Whether the button may receive focus even if it is disabled.
   * @default false
   */
  focusableWhenDisabled?: MaybeAccessor<boolean | '' | undefined>;
  tabIndex?: MaybeAccessor<string | number | undefined>;
  /**
   * Whether the component is being rendered as a native button.
   * @default true
   */
  native?: MaybeAccessor<boolean | '' | undefined>;
}

export interface UseButtonReturnValue {
  /**
   * Resolver for the button props.
   * @param externalProps additional props for the button
   * @returns props that should be spread on the button
   */
  /* eslint-disable-next-line typescript/no-explicit-any -- accepts arbitrary tag props; consumers pass merged BaseUIHTMLProps with various event handler shapes */
  getButtonProps: (externalProps?: ComponentProps<any>) => ComponentProps<any>;
  /**
   * A ref to the button DOM element. This ref should be passed to the rendered element.
   * It is not a part of the props returned by `getButtonProps`.
   */
  buttonRef: (
    value: HTMLButtonElement | HTMLAnchorElement | HTMLElement | null | undefined,
  ) => void;
}

export namespace useButton {
  export type Parameters = UseButtonParameters;
  export type ReturnValue = UseButtonReturnValue;
}
