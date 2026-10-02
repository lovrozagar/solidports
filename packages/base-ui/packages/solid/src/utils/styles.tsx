/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { onCleanup, onSettled } from 'solid-js';
import type { CSPContextValue } from '../csp-provider/CSPContext';

export const STYLE_TAG_ID = 'disable-scrollbar';
const DISABLE_SCROLLBAR_CLASS_NAME = 'base-ui-disable-scrollbar';

export const styleDisableScrollbar = {
  class: DISABLE_SCROLLBAR_CLASS_NAME,
  getElement(nonce?: string) {
    const style = document.createElement('style');

    style.id = STYLE_TAG_ID;
    style.textContent = `.${DISABLE_SCROLLBAR_CLASS_NAME}{scrollbar-width:none}.${DISABLE_SCROLLBAR_CLASS_NAME}::-webkit-scrollbar{display:none}`;

    (style as any).href = DISABLE_SCROLLBAR_CLASS_NAME;
    (style as any).precedence = 'base-ui:low';
    if (nonce) {
      style.nonce = nonce;
    }

    return style;
  },
};

export const useStyleDisableScrollbar = (csp: CSPContextValue) => {
  onSettled(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (csp.disableStyleElements()) {
      return;
    }

    if (!document.head.getElementsByTagName('style').namedItem(STYLE_TAG_ID)) {
      const el = styleDisableScrollbar.getElement(csp.nonce());
      document.head.appendChild(el);
      _c.push(() => {
        if (document.head.getElementsByTagName('style').namedItem(STYLE_TAG_ID)) {
          document.head.removeChild(el);
        }
      });
    }
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});
};
