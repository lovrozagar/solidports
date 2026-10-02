import { createTrackedEffect, createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useBaseUiId } from '../../utils/useBaseUiId';

type LabelSource = HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null | undefined };

function findAssociatedLabel(labelSource?: LabelSource | null) {
  if (!labelSource) {
    return undefined;
  }

  const parent = labelSource.parentElement;
  if (parent && parent.tagName === 'LABEL') {
    return parent as HTMLLabelElement;
  }

  const controlId = labelSource.id;
  if (controlId) {
    const nextSibling = labelSource.nextElementSibling as HTMLLabelElement | null;
    if (nextSibling && nextSibling.htmlFor === controlId) {
      return nextSibling;
    }
  }

  const labels = labelSource.labels;
  return labels && labels[0];
}

function getAriaLabelledBy(labelSource?: LabelSource | null, generatedLabelId?: string) {
  const label = findAssociatedLabel(labelSource);
  if (!label) {
    return undefined;
  }

  if (!label.id && generatedLabelId) {
    label.id = generatedLabelId;
  }

  return label.id || undefined;
}

/**
 * Resolves aria-labelledby for span-role controls labelled by wrapping/sibling native label.
 * Falls back to DOM label scanning when no explicit prop or context labelId is provided.
 */
export function useAriaLabelledBy(
  explicitAriaLabelledBy: Accessor<string | false | undefined>,
  labelId: Accessor<string | undefined>,
  labelSourceRef: Accessor<LabelSource | null | undefined>,
  enableFallback = true,
  labelSourceId?: Accessor<string | undefined>,
): Accessor<string | undefined> {
  const generatedLabelId = useBaseUiId(
    labelSourceId ? () => labelSourceId() ? `${labelSourceId()}-label` : undefined : undefined,
  );
  const [fallbackAriaLabelledBy, setFallbackAriaLabelledBy] = createSignal<string | undefined>();

  /* Run after each render so DOM association changes are reflected even when deps unchanged. */
  createTrackedEffect(() => {
    const explicit = explicitAriaLabelledBy();
    const label = labelId();
    const nextAriaLabelledBy =
      explicit || label || !enableFallback
        ? undefined
        : getAriaLabelledBy(labelSourceRef(), generatedLabelId());

    setFallbackAriaLabelledBy(nextAriaLabelledBy);
  });

  /* returned accessor — caller invokes in their tracked scope */
  // eslint-disable-next-line solid/reactivity
  return () => {
    const explicit = explicitAriaLabelledBy();
    return (typeof explicit === 'string' ? explicit : undefined) ?? labelId() ?? fallbackAriaLabelledBy();
  };
}
