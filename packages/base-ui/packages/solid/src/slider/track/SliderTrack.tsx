import type { JSX } from '@solidjs/web';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping, writeSliderState } from '../root/stateAttributesMapping';

const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set();
const TRACK_STYLE: JSX.CSSProperties = { position: 'relative' };
const trackStyle = () => TRACK_STYLE;

/**
 * Contains the slider indicator and represents the entire range of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderTrack(componentProps: SliderTrack.Props): JSX.Element {
  const { state } = useSliderRootContext();

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div>` with the slider's
  // state attributes, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeSliderState,
      mapping: sliderStateAttributesMapping,
      partStyle: trackStyle,
      reactive: true,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const element = useRenderElement('div', componentProps, {
    state,
    props: [{ style: { position: 'relative' } }, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping,
  });

  return element();
}

export interface SliderTrackState extends SliderRootState {}

export interface SliderTrackProps extends BaseUIComponentProps<'div', SliderTrackState> {}

export namespace SliderTrack {
  export type State = SliderTrackState;
  export type Props = SliderTrackProps;
}
