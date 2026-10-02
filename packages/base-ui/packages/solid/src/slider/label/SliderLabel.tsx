import { isHTMLElement } from '@floating-ui/utils/dom';
import { focusElementWithVisible, useLabel } from '../../internals/labelable-provider/useLabel';
import { ownerDocument } from '../../utils/owner';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { SliderRoot } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import { splitProps } from '../../solid-1-compat';

/**
 * An accessible label that is automatically associated with the slider thumbs.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderLabel(componentProps: SliderLabel.Props) {
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  const [, elementProps] = splitProps(componentProps as SliderLabel.Props & { id?: string }, [
    'class',
    'render',
    'style',
    'id',
  ]);

  const { state, setLabelId, controlRef, rootLabelId } = useSliderRootContext();

  function focusControl(event: MouseEvent, controlId: string | undefined) {
    if (controlId) {
      const controlElement = ownerDocument(event.currentTarget as Element).getElementById(
        controlId,
      );
      if (isHTMLElement(controlElement)) {
        focusElementWithVisible(controlElement);
        return;
      }
    }

    const fallbackInputs = controlRef.current?.querySelectorAll('input[type="range"]');
    const fallbackInput = fallbackInputs?.length === 1 ? fallbackInputs[0] : null;
    if (isHTMLElement(fallbackInput)) {
      focusElementWithVisible(fallbackInput);
    }
  }

  const labelProps = useLabel({
    id: rootLabelId,
    setLabelId,
    focusControl,
  });

  const element = useRenderElement('div', componentProps, {
    state,
    props: [labelProps, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping,
  });

  return <>{element()}</>;
}

export type SliderLabelState = SliderRoot.State;

export interface SliderLabelProps extends Omit<
  BaseUIComponentProps<'div', SliderLabel.State>,
  'id'
> {}

export namespace SliderLabel {
  export type State = SliderLabelState;
  export type Props = SliderLabelProps;
}
