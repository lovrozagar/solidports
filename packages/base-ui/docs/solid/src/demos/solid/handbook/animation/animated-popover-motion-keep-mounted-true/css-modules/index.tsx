

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
              <div />
            )}
          >
            Popup
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
