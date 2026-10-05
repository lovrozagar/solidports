import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import { NOOP } from '../../utils/noop';
import type { BaseUIHTMLProps, HTMLProps } from '../../utils/types';

export interface LabelableContext {
  /**
   * The `id` of the labelable element.
   * When `null` the label omits `htmlFor`, either because the association is implicit or
   * because the control takes its name from `aria-labelledby`.
   */
  controlId: Accessor<string | null | undefined>;
  registerControlId: (source: symbol, id: string | null | undefined) => void;
  resetControlId: () => void;
  /**
   * The `id` of the label.
   */
  labelId: Accessor<string | undefined>;
  setLabelId: Setter<string | undefined>;
  /**
   * An array of `id`s of elements that provide an accessible description.
   */
  messageIds: Accessor<string[]>;
  /**
   * Registers an accessor for a description element's `id` (`undefined` while it describes
   * nothing). Solid: the provider derives `messageIds` from the registered accessors, so the
   * control's `aria-describedby` updates in the same flush as the description.
   */
  registerMessageId: (source: Accessor<string | undefined>) => void;
  getDescriptionProps: (externalProps: HTMLProps | BaseUIHTMLProps) => BaseUIHTMLProps;
  /**
   * The control's `aria-describedby`: `external` (the control's own value) followed by the
   * description ids, as `getDescriptionProps` merges it. Tracks only the ids it reads.
   */
  describedBy: (external: unknown) => string | undefined;
}

/** The context outside any `LabelableProvider`: no label or description to wire. */
export const DEFAULT_LABELABLE_CONTEXT: LabelableContext = {
  controlId: () => undefined,
  getDescriptionProps: (externalProps) => externalProps,
  describedBy: (external) => (typeof external === 'string' ? external : undefined),
  labelId: () => undefined,
  messageIds: () => [],
  registerControlId: NOOP,
  resetControlId: NOOP,
  setLabelId: NOOP as Setter<string | undefined>,
  registerMessageId: NOOP,
};

/**
 * A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)\
 * with an accessible name (label) and description.
 */
export const LabelableContext = createContext<LabelableContext>(DEFAULT_LABELABLE_CONTEXT);

export function useLabelableContext() {
  return useContext(LabelableContext);
}
