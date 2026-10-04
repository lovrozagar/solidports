import { renderToString } from '@solidjs/web';
import { Toast } from '@solidports/base-ui/toast';

/** A page with an always-mounted toast portal, as an app's root renders it on the server. */
export function render(): string {
  const manager = Toast.createToastManager();
  return renderToString(() => (
    <Toast.Provider toastManager={manager}>
      <p>page</p>
      <Toast.Portal>
        <Toast.Viewport />
      </Toast.Portal>
    </Toast.Provider>
  ));
}
