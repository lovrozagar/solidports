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
  setMessageIds: Setter<string[]>;
  getDescriptionProps: (externalProps: HTMLProps | BaseUIHTMLProps) => BaseUIHTMLProps;
}

/**
 * A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)\
 * with an accessible name (label) and description.
 */
export const LabelableContext = createContext<LabelableContext>({
  controlId: () => undefined,
  getDescriptionProps: (externalProps) => externalProps,
  labelId: () => undefined,
  messageIds: () => [],
  registerControlId: NOOP,
  resetControlId: NOOP,
  setLabelId: NOOP as Setter<string | undefined>,
  setMessageIds: NOOP as Setter<string[]>,
});

export function useLabelableContext() {
  return useContext(LabelableContext);
}
