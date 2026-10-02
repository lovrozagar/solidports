import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { formatNumber } from '../../utils/formatNumber';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * Displays the current value of the slider as text.
 * Renders an `<output>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderValue(componentProps: SliderValue.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['aria-live', 'children']);

  const { thumbMap, state, values, format, locale } = useSliderRootContext();

  const outputFor = () =>
    Array.from(thumbMap().values(), ({ inputId }) => inputId)
      .join(' ')
      .trim() || undefined;

  const formattedValues = createMemo(() =>
    values().map((v) => formatNumber(v, locale(), format())),
  );

  const defaultDisplayValue = () => formattedValues().join(' – ');

  const element = useRenderElement('output', componentProps, {
    state,
    get children() {
      const children = local.children;
      return (
        <>
          {typeof children === 'function'
            ? children(formattedValues(), values())
            : defaultDisplayValue()}
        </>
      );
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

  return <>{element()}</>;
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
