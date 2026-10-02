import { createTrackedEffect, onCleanup } from 'solid-js';

import { isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '../../utils/owner';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import type { SliderRoot } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import { splitProps } from '../../solid-1-compat';

function focusElementWithVisible(element: HTMLElement) {
  element.focus({ preventScroll: true });
}

/**
 * An accessible label that is automatically associated with the slider thumbs.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderLabel(componentProps: SliderLabel.Props) {
  /* id driven by the store only — consumer cannot override. */
  const [, elementProps] = splitProps(componentProps, ['class', 'render'] as const);
  const id = useBaseUiId(undefined);

  const { state, setRootLabelId, controlRef } = useSliderRootContext();

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    setRootLabelId(id());
    _c.push(() => setRootLabelId(undefined));
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  function handleClick(event: MouseEvent) {
    const fallbackInputs = controlRef.current?.querySelectorAll('input[type="range"]');
    const fallbackInput = fallbackInputs?.length === 1 ? fallbackInputs[0] : null;
    if (isHTMLElement(fallbackInput)) {
      focusElementWithVisible(fallbackInput);
      return;
    }

    /* Try to find the control by id on the ownerDocument. */
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }

    const doc = ownerDocument(target);
    if (controlRef.current) {
      const inputs = controlRef.current.querySelectorAll<HTMLInputElement>('input[type="range"]');
      if (inputs.length === 1 && isHTMLElement(inputs[0])) {
        focusElementWithVisible(inputs[0]);
      }
    } else {
      const controlEl = doc.getElementById(id() ?? '');
      if (isHTMLElement(controlEl)) {
        focusElementWithVisible(controlEl);
      }
    }
  }

  return useRenderElement('div', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
        onClick: handleClick,
      },
      elementProps,
    ],
    state,
    stateAttributesMapping: sliderStateAttributesMapping,
  })();
}

export type SliderLabelState = SliderRoot.State;

export interface SliderLabelProps extends Omit<BaseUIComponentProps<'div', SliderLabelState>, 'id'> {}

export namespace SliderLabel {
  export type State = SliderLabelState;
  export type Props = SliderLabelProps;
}
