import { createSignal, getOwner, isHydrating, omit, onSettled } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import { platform } from './platform';
import { runInLazyScope } from './runInLazyScope';
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
  const role = useSafariGuardRole();

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

const NO_ROLE = () => undefined;
const BUTTON_ROLE = () => 'button' as const;

/**
 * The guard's role: `button` under VoiceOver on WebKit once mounted. Unlike NVDA and JAWS,
 * VoiceOver's virtual cursor triggers `onFocus` as it moves, but only on focusable/role-button
 * elements through WebKit's NSAccessibility path, so the role lets the focus trap catch the
 * cursor. Other environments create nothing.
 *
 * Only hydration waits for the mount, since the server rendered no role. The server cannot see the
 * platform, so the mount hook lives in a lazy scope: `onSettled` takes a hydration id, and under
 * the guard's owner it would take one the server gave a later node. A client render has no server
 * markup to match and gets the role at once, with no node.
 */
export function useSafariGuardRole(): () => 'button' | undefined {
  if (!(platform.screenReader.voiceOver && platform.engine.webkit)) {
    return NO_ROLE;
  }
  if (!isHydrating()) {
    return BUTTON_ROLE;
  }
  const [role, setRole] = createSignal<'button' | undefined>();
  runInLazyScope(getOwner(), () =>
    onSettled(() => {
      setRole('button');
    }),
  );
  return role;
}
