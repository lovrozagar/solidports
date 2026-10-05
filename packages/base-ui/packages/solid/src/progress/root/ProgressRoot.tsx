import { createMemo, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps, provideContext } from '../../solid-helpers';
import { clamp } from '../../utils/clamp';
import { formatNumber } from '../../utils/formatNumber';
import { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { valueToPercent } from '../../utils/valueToPercent';
import { visuallyHidden } from '../../utils/visuallyHidden';
import { ProgressRootContext } from './ProgressRootContext';
import { progressStateAttributesMapping } from './stateAttributesMapping';

/**
 * Groups all parts of the progress bar and provides the task completion status to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressRoot(componentProps: ProgressRoot.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'format',
    'getAriaValueText',
    'locale',
    'max',
    'min',
    'value',
  ]);
  const max = () => local.max ?? 100;
  const min = () => local.min ?? 0;
  const value = () => local.value;

  const [labelId, setLabelId] = createSignal<string | undefined>();

  // `value === null` (or any non-finite value) keeps Progress indeterminate. Otherwise compute a
  // single clamped value and normalized percentage so completion status, `aria-valuenow`, the
  // formatted text, the default `aria-valuetext`, and the indicator width all stay in sync for any
  // `min`/`max` (not just the default 0–100).
  // Solid: one memo derives the values React recomputes on every render.
  const derived = createMemo(() => {
    const currentValue = value();
    let status: ProgressStatus = 'indeterminate';
    let percentageValue: number | null = null;
    let clampedValue: number | null = null;
    let formattedValue = '';
    // Derived alongside `status` so the indeterminate condition is not restated anywhere else.
    let defaultAriaValueText = 'indeterminate progress';

    if (currentValue != null && Number.isFinite(currentValue)) {
      const rawPercentage = valueToPercent(currentValue, min(), max());
      percentageValue = clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
      clampedValue = clamp(currentValue, min(), max());
      status = clampedValue === max() ? 'complete' : 'progressing';
      // Format the clamped value so visible and accessible text stay in sync with `aria-valuenow` and
      // the indicator fill. The raw value remains available as the second `getAriaValueText` argument.
      formattedValue = local.format
        ? formatNumber(clampedValue, local.locale, local.format)
        : formatNumber(percentageValue / 100, local.locale, { style: 'percent' });
      defaultAriaValueText = formattedValue;
    }

    return { status, percentageValue, clampedValue, formattedValue, defaultAriaValueText };
  });

  const status = createMemo(() => derived().status);
  const formattedValue = createMemo(() => derived().formattedValue);
  const percentageValue = createMemo(() => derived().percentageValue);

  const state: ProgressRootState = {
    get status() {
      return status();
    },
  };

  const defaultProps: HTMLProps = {
    get 'aria-labelledby'() {
      return labelId();
    },
    get 'aria-valuemax'() {
      return max();
    },
    get 'aria-valuemin'() {
      return min();
    },
    get 'aria-valuenow'() {
      return derived().clampedValue ?? undefined;
    },
    get 'aria-valuetext'() {
      return local.getAriaValueText
        ? local.getAriaValueText(formattedValue(), value())
        : derived().defaultAriaValueText;
    },
    role: 'progressbar',
  };

  const contextValue: ProgressRootContext = {
    formattedValue,
    percentageValue,
    setLabelId,
    state,
    value,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    props: [defaultProps, elementProps],
    stateAttributesMapping: progressStateAttributesMapping,
    // The part owns its children (React destructures `children` out of the element props), so the
    // hidden span follows the consumer's children.
    get children() {
      return (
        <>
          {componentProps.children}
          <span role="presentation" style={visuallyHidden}>
            {/* force NVDA to read the label https://github.com/mui/base-ui/issues/4184 */}x
          </span>
        </>
      );
    },
  });

  return provideContext(ProgressRootContext, contextValue, element);
}

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';

export interface ProgressRootState {
  /**
   * The current status.
   */
  status: ProgressStatus;
}

export interface ProgressRootProps extends BaseUIComponentProps<'div', ProgressRootState> {
  /**
   * A string value that provides a user-friendly name for `aria-valuenow`, the current value of the progress bar.
   */
  'aria-valuetext'?: JSX.AriaAttributes['aria-valuetext'] | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * Accepts a function which returns a string value that provides a human-readable text alternative for the current value of the progress bar.
   */
  getAriaValueText?: ((formattedValue: string, value: number | null) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value. The component is indeterminate when value is `null`.
   */
  value: number | null;
}

export namespace ProgressRoot {
  export type State = ProgressRootState;
  export type Props = ProgressRootProps;
}
