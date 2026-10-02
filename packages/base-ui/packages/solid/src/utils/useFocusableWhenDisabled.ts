import { createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import { access, type MaybeAccessor } from '../solid-helpers';

export function useFocusableWhenDisabled(
  parameters: UseFocusableWhenDisabledParameters,
): UseFocusableWhenDisabledReturnValue {
  const focusableWhenDisabled = () => access(parameters.focusableWhenDisabled);
  const disabled = () => access(parameters.disabled);
  const composite = () => access(parameters.composite) ?? false;
  const tabIndexProp = () => access(parameters.tabIndex) ?? 0;
  const isNativeButton = () => access(parameters.isNativeButton);

  const isFocusableComposite = () => composite?.() && focusableWhenDisabled?.() !== false;
  const isNonFocusableComposite = () => composite?.() && focusableWhenDisabled?.() === false;

  // we can't explicitly assign `undefined` to any of these props because it
  // would otherwise prevent subsequently merged props from setting them
  const props = createMemo(() => {
    const additionalProps = {
      // allow Tabbing away from focusableWhenDisabled elements
      onKeyDown(event: KeyboardEvent) {
        if (disabled() && focusableWhenDisabled() && event.key !== 'Tab') {
          event.preventDefault();
        }
      },
    } as FocusableWhenDisabledProps;

    if (!composite()) {
      const tabIndex = tabIndexProp();
      additionalProps.tabindex = tabIndex;

      if (!isNativeButton() && disabled()) {
        additionalProps.tabindex = focusableWhenDisabled() ? (tabIndex ?? -1) : -1;
      }
    }

    if (
      (isNativeButton() && (focusableWhenDisabled() || isFocusableComposite())) ||
      (!isNativeButton() && disabled())
    ) {
      // React renders the boolean as a string; Solid 2 needs the string itself.
      additionalProps['aria-disabled'] = disabled() ? 'true' : 'false';
    }

    if (isNativeButton() && (!focusableWhenDisabled() || isNonFocusableComposite())) {
      additionalProps.disabled = disabled();
    }

    return additionalProps;
  });

  return { props };
}

interface FocusableWhenDisabledProps {
  'aria-disabled'?: 'true' | 'false' | undefined;
  disabled?: boolean | undefined;
  onKeyDown: (event: KeyboardEvent) => void;
  tabindex: string | number;
}

export interface UseFocusableWhenDisabledParameters {
  /**
   * Whether the component should be focusable when disabled.
   * When `undefined`, composite items are focusable when disabled by default.
   */
  focusableWhenDisabled?: MaybeAccessor<boolean | undefined>;
  /**
   * The disabled state of the component.
   */
  disabled: MaybeAccessor<boolean>;
  /**
   * Whether this is a composite item or not.
   * @default false
   */
  composite?: MaybeAccessor<boolean | undefined>;
  /**
   * @default 0
   */
  tabIndex?: MaybeAccessor<string | number | undefined>;
  /**
   * @default true
   */
  isNativeButton: MaybeAccessor<boolean>;
}

export interface UseFocusableWhenDisabledReturnValue {
  props: Accessor<FocusableWhenDisabledProps>;
}

export interface UseFocusableWhenDisabledState {}
