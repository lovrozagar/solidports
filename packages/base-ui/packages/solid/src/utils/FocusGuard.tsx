import { createSignal, omit, onSettled } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import { isSafari } from './detectBrowser';
import { visuallyHidden } from './visuallyHidden';

/**
 * @internal
 */
export function FocusGuard(
  props: ComponentProps<'span'> & {
    /**
     * Whether the guard takes focus. An inactive guard is an inert hidden span that holds the
     * guard's place in the DOM.
     * @default true
     */
    active?: boolean | undefined;
  },
) {
  const [role, setRole] = createSignal<'button' | undefined>();

  onSettled(() => {
    if (isSafari) {
      // Unlike other screen readers such as NVDA and JAWS, the virtual cursor
      // on VoiceOver does trigger the onFocus event, so we can use the focus
      // trap element. On Safari, only buttons trigger the onFocus event.
      setRole('button');
    }
  });

  const spanProps = omit(props, 'active');

  return (
    <span
      {...spanProps}
      ref={props.ref}
      role={props.active === false ? undefined : role()}
      aria-hidden={props.active !== false && role() ? undefined : 'true'}
      style={visuallyHidden}
      tabindex={props.active === false ? undefined : 0}
      data-base-ui-focus-guard={props.active === false ? undefined : ''}
    />
  );
}
