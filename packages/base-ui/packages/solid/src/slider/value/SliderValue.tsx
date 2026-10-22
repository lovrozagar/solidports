import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { formatNumber } from '../../utils/formatNumber';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping, writeSliderState } from '../root/stateAttributesMapping';

const OUTPUT = { tag: 'output', create: () => (<output />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set(['aria-live', 'children']);

interface SliderValueModel {
  ariaLive: () => unknown;
  outputFor: () => string | undefined;
}

function writeValueAttributes(w: SetAttribute, model: SliderValueModel) {
  w.set('aria-live', model.ariaLive());
  w.set('for', model.outputFor());
}

/**
 * Displays the current value of the slider as text.
 * Renders an `<output>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderValue(componentProps: SliderValue.Props): JSX.Element {
  const local = componentProps;

  const { thumbMap, state, values, format, locale } = useSliderRootContext();

  const outputFor = () =>
    Array.from(thumbMap().values(), ({ inputId }) => inputId)
      .join(' ')
      .trim() || undefined;

  const formattedValues = createMemo(() =>
    values().map((v) => formatNumber(v, locale(), format())),
  );

  const defaultDisplayValue = () => formattedValues().join(' – ');

  const content = () => {
    const children = local.children;
    return (
      <>
        {typeof children === 'function'
          ? children(formattedValues(), values())
          : defaultDisplayValue()}
      </>
    );
  };

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<output>` with its value
  // text, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    const model: SliderValueModel = {
      // off by default because it will keep announcing when the slider is being dragged
      // and also when the value is changing (but not yet committed)
      ariaLive: () => local['aria-live'] ?? 'off',
      outputFor,
    };
    return renderNativeElement(OUTPUT, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeSliderState,
      mapping: sliderStateAttributesMapping,
      attributes: writeValueAttributes,
      handlerTarget: model,
      reactive: true,
      children: content,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, ['aria-live', 'children']);

  const element = useRenderElement('output', componentProps, {
    state,
    get children() {
      return content();
    },
    props: [
      {
        // off by default because it will keep announcing when the slider is being dragged
        // and also when the value is changing (but not yet committed)
        get 'aria-live'() {
          return local['aria-live'] ?? 'off';
        },
        get for() {
          return outputFor();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });

  return element();
}

export interface SliderValueState extends SliderRootState {}

export interface SliderValueProps extends Omit<
  BaseUIComponentProps<'output', SliderValueState>,
  'children'
> {
  children?:
    | null
    | ((formattedValues: readonly string[], values: readonly number[]) => JSX.Element)
    | undefined;
}

export namespace SliderValue {
  export type State = SliderValueState;
  export type Props = SliderValueProps;
}
