import { fieldValidityMapping } from '../../field/utils/constants';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { compileStateWriter } from '../../utils/native/element';
import type { SliderRoot } from './SliderRoot';

export const sliderStateAttributesMapping: StateAttributesMapping<SliderRoot.State> = {
  activeThumbIndex: () => null,
  max: () => null,
  min: () => null,
  minStepsBetweenValues: () => null,
  step: () => null,
  values: () => null,
  ...fieldValidityMapping,
};

/** The slider's state attributes, compiled once for the native parts. */
export const writeSliderState = compileStateWriter(
  [
    'disabled',
    'touched',
    'dirty',
    'valid',
    'filled',
    'focused',
    'activeThumbIndex',
    'dragging',
    'max',
    'min',
    'minStepsBetweenValues',
    'orientation',
    'step',
    'values',
  ],
  sliderStateAttributesMapping,
);
