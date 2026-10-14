import { createSignal, flush, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { createDepsEffect } from '../../solid-helpers';
import { observeLabels } from './observeLabels';

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

  // `labels` resolves `<label for>` across the document (a lookup per control); a document
  // without any `<label>` has none to find (the collection is live and cached by the browser).
  if (labelSource.ownerDocument.getElementsByTagName('label').length === 0) {
    return undefined;
  }
  const labels = labelSource.labels;
  return labels && labels[0];
}

/**
 * The id of the label associated with `labelSource` (a wrapping `<label>`, a following sibling
 * `<label for>`, or its first `labels` entry), giving the label `generatedLabelId` when it has none.
 */
export function getAriaLabelledBy(labelSource?: LabelSource | null, generatedLabelId?: string) {
  const label = findAssociatedLabel(labelSource);
  if (!label) {
    return undefined;
  }

  if (!label.id && generatedLabelId) {
    label.id = generatedLabelId;
  }

  return label.id || undefined;
}

/** A non-blank `aria-label` names the control itself, as it does on a native input. */
export function ariaLabelOverridesLabel(ariaLabel: unknown): boolean {
  return typeof ariaLabel === 'string' && ariaLabel.trim() !== '';
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
  ariaLabel?: Accessor<unknown>,
): Accessor<string | undefined> {
  const generatedLabelId = useBaseUiId(
    labelSourceId ? () => (labelSourceId() ? `${labelSourceId()}-label` : undefined) : undefined,
  );
  const [fallbackAriaLabelledBy, setFallbackAriaLabelledBy] = createSignal<string | undefined>();

  let stopObserving: (() => void) | undefined;
  void onCleanup(() => stopObserving?.());

  // React runs this after every render; here it runs when any input changes, and while the
  // fallback is in use, when a label in the control's tree mounts or unmounts. The DOM label
  // lookup happens in the apply phase.
  createDepsEffect(
    () => ({
      explicit: explicitAriaLabelledBy(),
      label: labelId(),
      labelSource: labelSourceRef(),
      generatedLabelId: generatedLabelId(),
      ariaLabel: ariaLabel?.(),
    }),
    (deps) => {
      stopObserving?.();
      stopObserving = undefined;
      if (
        deps.explicit ||
        deps.label ||
        ariaLabelOverridesLabel(deps.ariaLabel) ||
        !enableFallback ||
        !deps.labelSource
      ) {
        setFallbackAriaLabelledBy(undefined);
        return;
      }
      const labelSource = deps.labelSource;
      const resolve = () => getAriaLabelledBy(labelSource, deps.generatedLabelId);
      setFallbackAriaLabelledBy(resolve());
      // A wrapping label leaves with the control; any other label can mount or unmount on its own.
      if (labelSource.parentElement?.tagName !== 'LABEL') {
        stopObserving = observeLabels(labelSource.getRootNode(), () => {
          setFallbackAriaLabelledBy(resolve());
          flush();
        });
      }
    },
  );

  /* returned accessor — caller invokes in their tracked scope */

  return () => {
    const explicit = explicitAriaLabelledBy();
    if (typeof explicit === 'string') {
      return explicit;
    }
    if (ariaLabelOverridesLabel(ariaLabel?.())) {
      return undefined;
    }
    return labelId() ?? fallbackAriaLabelledBy();
  };
}
