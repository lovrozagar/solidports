import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { animate, type DOMKeyframesDefinition } from 'motion';
import { Popover } from '@solidports/base-ui/popover';
import styles from './index.module.css';

export default function AnimatedPopoverMotionKeepMountedFalseDemo() {
  return (
    <Popover.Root>
      <Popover.Trigger class={styles.Trigger}>Trigger</Popover.Trigger>
      {/* Solid has no `AnimatePresence`: Base UI keeps the popup mounted while its
          exit animation (`transitionStatus: 'ending'`) runs, then unmounts it. */}
      <Popover.Portal>
        <Popover.Positioner class={styles.Positioner} sideOffset={8}>
          <Popover.Popup
            class={styles.Popup}
            render={(props, state) => (
              <MotionDiv
                {...props}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  state.transitionStatus === 'ending'
                    ? { opacity: 0, scale: 0.8 }
                    : { opacity: 1, scale: 1 }
                }
              />
            )}
          >
            Popup
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface MotionDivProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /** Styles to start from when mounted, or `false` to start at `animate`. */
  initial: DOMKeyframesDefinition | false;
  /** Styles to animate to whenever they change. */
  animate: DOMKeyframesDefinition;
}

/** A minimal `motion.div`: Motion's `animate()` moves the element toward `animate`. */
function MotionDiv(props: MotionDivProps) {
  const others = omit(props, 'initial', 'animate', 'ref');
  let element: HTMLDivElement | undefined;
  let animated = false;

  createEffect(
    () => ({ target: props.animate, instant: !animated && props.initial === false }),
    ({ target, instant }) => {
      animated = true;
      if (element) {
        animate(element, target, instant ? { duration: 0 } : undefined);
      }
    },
  );

  return (
    <div
      {...others}
      ref={[
        props.ref,
        (el: HTMLDivElement) => {
          element = el;
          if (props.initial) {
            animate(el, props.initial, { duration: 0 });
          }
        },
      ]}
    />
  );
}
