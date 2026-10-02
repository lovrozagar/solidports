import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { animate, type DOMKeyframesDefinition } from 'motion';
import { Popover } from '@solidports/base-ui/popover';
import styles from './index.module.css';

export default function AnimatedPopoverMotionKeepMountedTrueDemo() {
  return (
    <Popover.Root>
      <Popover.Trigger class={styles.Trigger}>Trigger</Popover.Trigger>
      <Popover.Portal keepMounted>
        <Popover.Positioner class={styles.Positioner} sideOffset={8}>
          <Popover.Popup
            class={styles.Popup}
            render={(props, state) => (
              <MotionDiv
                {...props}
                initial={false}
                animate={{
                  opacity: state.open ? 1 : 0,
                  scale: state.open ? 1 : 0.8,
                }}
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
