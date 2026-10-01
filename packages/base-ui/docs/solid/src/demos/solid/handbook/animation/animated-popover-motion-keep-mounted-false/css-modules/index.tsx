import { createSignal } from 'solid-js';


import { Popover } from '@solidports/base-ui/popover';
import styles from './index.module.css';

export default function AnimatedPopoverMotionKeepMountedFalseDemo() {
  const [open, setOpen] = createSignal(false);

  return (
    <Popover.Root open={open()} onOpenChange={setOpen}>
      <Popover.Trigger class={styles.Trigger}>Trigger</Popover.Trigger>
      
        {open() && (
          <Popover.Portal keepMounted>
            <Popover.Positioner class={styles.Positioner} sideOffset={8}>
              <Popover.Popup
                class={styles.Popup}
                render={
                  <div />
                }
              >
                Popup
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        )}
      
    </Popover.Root>
  );
}
