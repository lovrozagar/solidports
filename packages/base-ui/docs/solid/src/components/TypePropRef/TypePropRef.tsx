import { createMemo } from 'solid-js';
import type { TypePropRefProps } from '@mui/internal-docs-infra/useType';
import './TypePropRef.css';

/**
 * Renders a type property reference.
 * Definition sites (`id` is present) render a plain span with the anchor id.
 * Reference sites render a plain anchor to that definition.
 */
function kebabToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
export function TypePropRef(props: TypePropRefProps) {
  const resolvedHref = createMemo(() => `#${props.name}-${kebabToCamelCase(props.prop)}`);
  const _render = createMemo(() => {
    if (props.id) {
      return (
        <span id={props.id} class={props.class}>
          {props.children}
        </span>
      );
    }
    return (
      <a href={resolvedHref()} class={`${props.class ?? ''} TypePropRefLink`.trim()}>
        {props.children}
      </a>
    );
  });
  return <>{_render()}</>;
}
