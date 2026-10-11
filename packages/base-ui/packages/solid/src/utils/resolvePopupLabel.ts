interface PopupLabelProps {
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  render?: unknown;
}

/**
 * Label for a popup: an explicit `aria-label` wins, then `aria-labelledby`, then the trigger's id.
 * A `render` element's own label props win over the part props, matching `useRenderElement`.
 */
export function resolvePopupLabel(
  props: PopupLabelProps,
  activeTriggerElement: Element | null,
  activeTriggerId: string | null,
) {
  const render = props.render;
  const renderedElementProps =
    render != null && typeof render === 'object' && !(render instanceof Node)
      ? (render as { 'aria-label'?: string; 'aria-labelledby'?: string })
      : undefined;
  const ariaLabel = props['aria-label'] ?? renderedElementProps?.['aria-label'];
  let ariaLabelledBy = props['aria-labelledby'] ?? renderedElementProps?.['aria-labelledby'];

  if (ariaLabelledBy == null && !ariaLabel) {
    ariaLabelledBy = activeTriggerElement
      ? activeTriggerElement.id || undefined
      : activeTriggerId || undefined;
  }

  return ariaLabelledBy;
}
