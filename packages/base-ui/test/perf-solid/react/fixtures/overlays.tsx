import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Drawer } from '@base-ui/react/drawer';
import { Popover } from '@base-ui/react/popover';
import { Tooltip } from '@base-ui/react/tooltip';
import { PreviewCard } from '@base-ui/react/preview-card';
import { size } from '../../shared/sizes';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const fixed: React.CSSProperties = {
  position: 'fixed',
  top: '10px',
  left: '10px',
  width: '320px',
  maxHeight: '400px',
  overflow: 'auto',
  background: 'white',
};
const backdrop: React.CSSProperties = { position: 'fixed', inset: '0' };

/** `n` nodes, every 10th a button (focusable). */
function Content(props: { n: number }) {
  return (
    <div>
      {range(props.n).map((i) =>
        i % 10 === 0 ? (
          <button key={i} type="button">
            Item button {i}
          </button>
        ) : (
          <span key={i}>Item {i} </span>
        ),
      )}
    </div>
  );
}

function DialogContent() {
  return (
    <Dialog.Root>
      <Dialog.Trigger data-testid="dialog-trigger">Open dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop data-testid="dialog-backdrop" style={backdrop} />
        <Dialog.Popup style={fixed}>
          <Dialog.Title>Dialog</Dialog.Title>
          <Content n={size(500)} />
          <Dialog.Root>
            <Dialog.Trigger data-testid="nested-trigger">Open nested</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup style={fixed}>
                <Dialog.Title>Nested</Dialog.Title>
                <Dialog.Close>Close nested</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <Dialog.Close data-testid="dialog-close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DialogRoots() {
  return (
    <div>
      {range(size(200)).map((i) => (
        <Dialog.Root key={i}>
          <Dialog.Trigger>Open {i}</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup style={fixed}>
              <Dialog.Title>Dialog {i}</Dialog.Title>
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ))}
    </div>
  );
}

function AlertContent() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger data-testid="alert-trigger">Delete</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop style={backdrop} />
        <AlertDialog.Popup style={fixed}>
          <AlertDialog.Title>Delete?</AlertDialog.Title>
          <Content n={size(500)} />
          <AlertDialog.Close data-testid="alert-confirm">Confirm</AlertDialog.Close>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

const drawerPopup: React.CSSProperties = {
  position: 'fixed',
  top: '0',
  right: '0',
  width: '320px',
  height: '100%',
  overflow: 'auto',
  background: 'white',
};

function DrawerContent() {
  return (
    <Drawer.Root swipeDirection="right">
      <Drawer.Trigger data-testid="drawer-trigger">Open drawer</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop style={backdrop} />
        <Drawer.Viewport>
          <Drawer.Popup data-testid="drawer-popup" style={drawerPopup}>
            <Drawer.Content>
              <Drawer.Title>Drawer</Drawer.Title>
              <Content n={size(500)} />
              <Drawer.Root swipeDirection="right">
                <Drawer.Trigger data-testid="nested-drawer-trigger">Open nested</Drawer.Trigger>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup style={drawerPopup}>
                      <Drawer.Content>
                        <Drawer.Title>Nested</Drawer.Title>
                        <Drawer.Close>Close nested</Drawer.Close>
                      </Drawer.Content>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
              <Drawer.Close>Close</Drawer.Close>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function PopoverPopupContent() {
  return (
    <Popover.Portal>
      <Popover.Positioner sideOffset={8}>
        <Popover.Popup
          data-testid="popover-popup"
          style={{ width: '300px', maxHeight: '300px', overflow: 'auto', background: 'white' }}
        >
          <Popover.Title>Popover</Popover.Title>
          <Content n={size(200)} />
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}

function PopoverContent() {
  return (
    <div style={{ height: '3000px', paddingTop: '200px' }}>
      <Popover.Root>
        <Popover.Trigger data-testid="popover-trigger">Popover</Popover.Trigger>
        <PopoverPopupContent />
      </Popover.Root>
      <Popover.Root>
        <Popover.Trigger data-testid="hover-trigger" openOnHover delay={0} closeDelay={0}>
          Hover popover
        </Popover.Trigger>
        <PopoverPopupContent />
      </Popover.Root>
    </div>
  );
}

function PopoverRoots() {
  return (
    <div>
      {range(size(500)).map((i) => (
        <Popover.Root key={i}>
          <Popover.Trigger>Popover {i}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content {i}</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ))}
    </div>
  );
}

const popoverHandle = Popover.createHandle();
function PopoverHandle() {
  return (
    <div>
      {range(20).map((i) => (
        <Popover.Trigger key={i} data-testid="handle-trigger" handle={popoverHandle}>
          Trigger {i}
        </Popover.Trigger>
      ))}
      <Popover.Root handle={popoverHandle}>
        <PopoverPopupContent />
      </Popover.Root>
    </div>
  );
}

function TooltipRoots() {
  return (
    <Tooltip.Provider delay={0} closeDelay={0}>
      {range(size(500)).map((i) => (
        <Tooltip.Root key={i}>
          <Tooltip.Trigger data-testid="tooltip-trigger">T {i}</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="tooltip-popup">Tip {i}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ))}
    </Tooltip.Provider>
  );
}

const tooltipHandle = Tooltip.createHandle();
function TooltipHandle() {
  return (
    <Tooltip.Provider delay={0} closeDelay={0}>
      {range(size(500)).map((i) => (
        <Tooltip.Trigger key={i} data-testid="tooltip-trigger" handle={tooltipHandle}>
          T {i}
        </Tooltip.Trigger>
      ))}
      <Tooltip.Root handle={tooltipHandle}>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="tooltip-popup">Shared tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function PreviewCardRoots() {
  return (
    <div>
      {range(size(200)).map((i) => (
        <PreviewCard.Root key={i}>
          <PreviewCard.Trigger data-testid="card-trigger" href="#" delay={0} closeDelay={0}>
            Link {i}
          </PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid="card-popup">Card {i}</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ))}
    </div>
  );
}

export const fixtures: Record<string, React.FC> = {
  'dialog/content': DialogContent,
  'dialog/roots': DialogRoots,
  'alert-dialog/content': AlertContent,
  'drawer/content': DrawerContent,
  'popover/content': PopoverContent,
  'popover/roots': PopoverRoots,
  'popover/handle': PopoverHandle,
  'tooltip/roots': TooltipRoots,
  'tooltip/handle': TooltipHandle,
  'preview-card/roots': PreviewCardRoots,
};
