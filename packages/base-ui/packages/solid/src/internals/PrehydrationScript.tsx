import { createSignal, onMount, Show } from 'solid-js';
import { useCSPContext } from './csp-context/CSPContext';

/**
 * Renders an inline script that runs before hydration for components that need to position
 * server-rendered content (e.g. Tabs.Indicator, Slider.Thumb).
 */
export function PrehydrationScript(props: PrehydrationScript.Props) {
  const { nonce } = useCSPContext();
  const [hydrating, setHydrating] = createSignal(true);

  onMount(() => {
    setHydrating(false);
  });

  return (
    <Show when={hydrating()}>
      <script nonce={nonce()} innerHTML={props.script} />
    </Show>
  );
}

export namespace PrehydrationScript {
  export interface Props {
    /**
     * The script source. Empty in client bundles.
     */
    script: string;
  }
}
