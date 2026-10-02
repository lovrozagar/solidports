import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';


import { Dialog } from '@solidports/base-ui/dialog';
import { Menu } from '@solidports/base-ui/menu';
import styles from './index.module.css';

export default function ExampleDialog() {
  const [dialogOpen, setDialogOpen] = createSignal(false);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger class={styles.Button}>
          Playlist <CaretDownIcon />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner class={styles.Positioner} sideOffset={8} align="start">
            <Menu.Popup class={styles.MenuPopup}>
              <Menu.Item class={styles.MenuItem}>Play</Menu.Item>
              <Menu.Item class={styles.MenuItem}>Share</Menu.Item>
              <Menu.Separator class={styles.Separator} />
              {/* Open the dialog when the menu item is clicked */}
              <Menu.Item class={styles.MenuItem} onClick={() => setDialogOpen(true)}>
                Details…
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {/* Control the dialog state */}
      <Dialog.Root open={dialogOpen()} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop class={styles.Backdrop} />
          <Dialog.Popup class={styles.DialogPopup}>
            <div class={styles.Intro}>
              <Dialog.Title class={styles.Title}>Playlist details</Dialog.Title>
              <Dialog.Description class={styles.Description}>
                This playlist contains 24 songs and was last updated today.
              </Dialog.Description>
            </div>
            <div class={styles.Actions}>
              <Dialog.Close class={styles.Button}>Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function CaretDownIcon(props: Omit<JSX.SvgSVGAttributes<SVGSVGElement>, 'style'> & { style?: JSX.CSSProperties }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M12 6H4l4 4.5z" />
    </svg>
  );
}
