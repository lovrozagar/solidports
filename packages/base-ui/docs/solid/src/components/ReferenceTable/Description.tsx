import { Show } from 'solid-js';

/**
 * A reference description. `html` is rendered from the JSDoc markdown at build time
 * (`descriptionHtml.mjs`, via rehypeReference), as the React docs render theirs through the types
 * pipeline; `text` is the raw description for data that did not go through it.
 */
export function Description(props: { html?: string; text?: string }) {
  return (
    <Show when={props.html !== undefined} fallback={props.text}>
      <div class="ReferenceDescriptionText" innerHTML={props.html} />
    </Show>
  );
}
