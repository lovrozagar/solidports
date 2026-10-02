import type { JSX } from '@solidjs/web';
import { visuallyHiddenInput } from '../../utils/visuallyHidden';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

type DismissEvent = MouseEvent | KeyboardEvent;

/**
 * @internal
 */
export function ComboboxInternalDismissButton(props: {
  ref: (element: HTMLSpanElement | null | undefined) => void;
  hidden?: boolean | undefined;
}): JSX.Element {
  const store = useComboboxRootContext();

  const { buttonRef, getButtonProps } = useButton({
    native: false,
  });

  function handleDismiss(event: DismissEvent) {
    store.context.setOpen(
      false,
      createChangeEventDetails(
        REASONS.closePress,
        event,
        event.currentTarget as HTMLElement | undefined,
      ),
    );
  }

  return (
    <span
      ref={(element) => {
        props.ref(element);
        buttonRef(element);
      }}
      // Solid: the button props are read in the spread so they stay reactive.
      {...getButtonProps({
        onClick: handleDismiss,
      })}
      aria-label="Dismiss"
      tabindex={undefined}
      hidden={props.hidden}
      style={visuallyHiddenInput}
    />
  );
}
