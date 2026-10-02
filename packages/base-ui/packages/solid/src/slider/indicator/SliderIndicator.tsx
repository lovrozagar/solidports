import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useIsHydrating } from '../../utils/useIsHydrating';
import { useRenderElement } from '../../utils/useRenderElement';
import { valueToPercent } from '../../utils/valueToPercent';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';

function getIndicatorStyles(
  vertical: boolean,
  range: boolean,
  inset: boolean,
  start: number | undefined,
  end: number | undefined,
  forceHidden: boolean,
): JSX.CSSProperties & Record<string, unknown> {
  const styles: JSX.CSSProperties & Record<string, unknown> = {
    visibility:
      forceHidden || (inset && (start === undefined || (range && end === undefined)))
        ? ('hidden' as const)
        : undefined,
    position: vertical ? 'absolute' : 'relative',
    [vertical ? 'width' : 'height']: 'inherit',
  };

  let startValue: string = `${start ?? 0}%`;
  let sizeValue: string = `${(end ?? 0) - (start ?? 0)}%`;

  if (inset) {
    styles['--start-position'] = startValue;
    startValue = 'var(--start-position)';

    if (range) {
      styles['--relative-size'] = sizeValue;
      sizeValue = 'var(--relative-size)';
    }
  }

  styles[vertical ? 'bottom' : 'inset-inline-start'] = range ? startValue : 0;
  styles[vertical ? 'height' : 'width'] = range ? sizeValue : startValue;

  return styles;
}

/**
 * Visualizes the current value of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderIndicator(componentProps: SliderIndicator.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { indicatorPosition, inset, max, min, orientation, renderBeforeHydration, state, values } =
    useSliderRootContext();

  const isHydrating = useIsHydrating();

  const style = () => {
    const vertical = orientation() === 'vertical';
    const currentValues = values();
    const range = currentValues.length > 1;
    const isInset = inset();

    return getIndicatorStyles(
      vertical,
      range,
      isInset,
      isInset ? indicatorPosition()[0] : valueToPercent(currentValues[0], min(), max()),
      isInset
        ? indicatorPosition()[1]
        : valueToPercent(currentValues[currentValues.length - 1], min(), max()),
      isInset && renderBeforeHydration() && isHydrating(),
    );
  };

  const element = useRenderElement('div', componentProps, {
    state,
    props: [
      {
        get ['data-base-ui-slider-indicator' as string]() {
          return renderBeforeHydration() ? '' : undefined;
        },
        get style() {
          return style();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface SliderIndicatorState extends SliderRootState {}

export interface SliderIndicatorProps extends BaseUIComponentProps<'div', SliderIndicatorState> {}

export namespace SliderIndicator {
  export type State = SliderIndicatorState;
  export type Props = SliderIndicatorProps;
}
