// `next/script` for the Solid docs: the script loads after the page hydrates (Next's default
// `afterInteractive` strategy), once per `id` or `src`.
import { onSettled } from 'solid-js';

export interface ScriptProps {
  id?: string;
  src?: string;
  strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker';
  innerHTML?: string;
  children?: string;
  async?: boolean;
  defer?: boolean;
  nonce?: string;
  onLoad?: (event: Event) => void;
  onReady?: () => void;
  onError?: (event: Event | string) => void;
}

const loaded = new Set<string>();

export default function Script(props: ScriptProps) {
  onSettled(() => {
    const key = props.id ?? props.src;
    if (key && loaded.has(key)) {
      props.onReady?.();
      return;
    }
    const start = () => {
      const script = document.createElement('script');
      if (props.id) {
        script.id = props.id;
      }
      if (props.nonce) {
        script.nonce = props.nonce;
      }
      if (props.src) {
        script.src = props.src;
        script.async = props.async ?? true;
      }
      const inline = props.innerHTML ?? props.children;
      if (inline) {
        script.textContent = inline;
      }
      script.addEventListener('load', (event) => {
        props.onLoad?.(event);
        props.onReady?.();
      });
      script.addEventListener('error', (event) => props.onError?.(event));
      document.body.appendChild(script);
      if (key) {
        loaded.add(key);
      }
      if (!props.src) {
        props.onReady?.();
      }
    };
    if (props.strategy === 'lazyOnload') {
      window.addEventListener('load', start, { once: true });
    } else {
      start();
    }
  });
  return null;
}
