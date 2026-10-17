import { createContext, createSignal, flush, Show, useContext } from 'solid-js';
import { render } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { provideContext } from '../../src/solid-helpers';

const Label = createContext('none');

/**
 * A part that provides a context and renders a reactive attribute, with a consumer that mounts
 * after the first paint. Run against the production client runtime: an owner the runtime disposes
 * or a context it never carried shows as a stale attribute or the context's default.
 */
export function renderLateConsumer() {
  const root = document.createElement('div');
  document.body.append(root);
  const [late, setLate] = createSignal(false);
  const [count, setCount] = createSignal(0);
  function Part(props: { children: JSX.Element }) {
    return provideContext(Label, 'provided', () => (
      <div data-count={count()}>{props.children}</div>
    ));
  }
  function Reader() {
    const label = useContext(Label);
    return <span>{label}</span>;
  }
  const dispose = render(
    () => (
      <Part>
        <Show when={late()}>
          <Reader />
        </Show>
      </Part>
    ),
    root,
  );
  flush();
  const first = root.innerHTML;
  setCount(1);
  setLate(true);
  flush();
  setCount(2);
  flush();
  const last = root.innerHTML;
  dispose();
  root.remove();
  return { first, last };
}
