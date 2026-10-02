import { Show } from 'solid-js';
import { useIsHydrating } from '../utils/useIsHydrating';
import { useCSPContext } from './csp-context/CSPContext';

/**
 * Renders an inline script that runs before hydration for components that need to position
 * server-rendered content (e.g. Tabs.Indicator, Slider.Thumb).
 */
export function PrehydrationScript(props: PrehydrationScript.Props) {
  const { nonce } = useCSPContext();
  const isHydrating = useIsHydrating();

  return (
    <Show when={isHydrating()}>
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
