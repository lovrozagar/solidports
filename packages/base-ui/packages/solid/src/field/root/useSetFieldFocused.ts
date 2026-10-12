import { untrack } from 'solid-js';
import { access, createLayoutEffect, type MaybeAccessor } from '../../solid-helpers';
import { DEFAULT_FIELD_ROOT_CONTEXT, useFieldRootContext } from './FieldRootContext';

/**
 * Returns the field's `setFocused`, recording which control the focused state belongs to.
 *
 * Disabling or unmounting a focused control moves focus away without firing `blur`, so the focused
 * state would otherwise stay latched. A field can have several focus targets, so a control only
 * clears the shared state when focus last landed on itself. The callback identity is that owner.
 */
export function useSetFieldFocused(
  disabled: MaybeAccessor<boolean | undefined>,
  focusTargetRef: { current: Element | null | undefined },
  onFocusedChange?: ((focused: boolean) => void) | undefined,
) {
  const fieldRootContext = useFieldRootContext();
  // Solid: outside a field `setFocused` is a no-op, so skip the effect and its reactive nodes.
  if (fieldRootContext === DEFAULT_FIELD_ROOT_CONTEXT && onFocusedChange === undefined) {
    return noop;
  }
  const { setFocused, focusOwnerRef } = fieldRootContext;

  const setFieldFocused = (focused: boolean) => {
    // Latest disabled state, including when a layout effect calls this after `disabled` changes.
    const isDisabled = untrack(() => access(disabled));
    // A disabled target can still be focused (`aria-disabled` elements stay programmatically
    // focusable), but must not publish the field's focused styling.
    if (focused ? !isDisabled : focusOwnerRef.current === setFieldFocused) {
      focusOwnerRef.current = focused ? setFieldFocused : undefined;
      onFocusedChange?.(focused);
      setFocused(focused);
    }
  };

  // Re-run when `disabled` changes so a focused control releases the field even when the browser
  // does not fire `blur`. The setup reclaims focus that no focus event reported: a control focused
  // before hydration, or an `aria-disabled` control re-enabled while it kept focus.
  createLayoutEffect(
    () => access(disabled),
    () => {
      const el = focusTargetRef.current;
      const root = el?.getRootNode() as Document | ShadowRoot | undefined;
      if (root?.activeElement === el) {
        setFieldFocused(true);
      }
      return () => setFieldFocused(false);
    },
  );

  return setFieldFocused;
}

function noop(_focused: boolean) {}
