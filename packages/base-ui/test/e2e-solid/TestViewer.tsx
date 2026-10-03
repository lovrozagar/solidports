import type { JSX } from '@solidjs/web';
import { createSignal, onSettled } from 'solid-js';

export default function TestViewer(props: { children: JSX.Element }) {
  // As the React viewer: the fixture is ready once its first render and effects have settled.
  const [ready, setReady] = createSignal(false);
  onSettled(() => {
    setReady(true);
  });

  return (
    <div aria-busy={ready() ? 'false' : 'true'} data-testid="testcase">
      {props.children}
    </div>
  );
}
