import { isHTMLElement } from '@floating-ui/utils/dom';
import type { JSX } from '@solidjs/web';
import {
  focusElementWithVisible,
  getControlById,
  useLabel,
} from '../../internals/labelable-provider/useLabel';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { canRenderNative, partHandler } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import type { SliderRoot } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping, writeSliderState } from '../root/stateAttributesMapping';
import { splitProps } from '../../solid-1-compat';

const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
// `id` too: the label's id is derived from the root.
const OWN_KEYS: ReadonlySet<string> = new Set(['id']);

function writeLabelAttributes(w: SetAttribute, labelProps: HTMLProps) {
  w.set('id', labelProps.id);
}

type LabelHandler = (event: Event) => void;
const forwardTo = (key: 'onMouseDown' | 'onClick' | 'onPointerDown') =>
  partHandler<HTMLProps>(key, (labelProps, event) =>
    (labelProps[key] as unknown as LabelHandler)(event),
  );

const LABEL_HANDLERS = {
  onMouseDown: forwardTo('onMouseDown'),
  onClick: forwardTo('onClick'),
  onPointerDown: forwardTo('onPointerDown'),
};

/**
 * An accessible label that is automatically associated with the slider thumbs.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderLabel(componentProps: SliderLabel.Props): JSX.Element {
  const { state, setLabelId, controlRef, rootLabelId } = useSliderRootContext();

  function focusControl(event: MouseEvent, controlId: string | undefined) {
    if (controlId) {
      const controlElement = getControlById(event.currentTarget as Element, controlId);
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

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div>` with its id and
  // handlers, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeSliderState,
      mapping: sliderStateAttributesMapping,
      attributes: writeLabelAttributes,
      handlers: LABEL_HANDLERS,
      handlerTarget: labelProps,
      reactive: true,
    }) as unknown as JSX.Element;
  }

  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  const [, elementProps] = splitProps(
    componentProps as SliderLabel.Props & { id?: string | undefined },
    ['class', 'render', 'style', 'id'],
  );

  const element = useRenderElement('div', componentProps, {
    state,
    props: [labelProps, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping,
  });

  return element();
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
