import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { ProgressRootState } from '../root/ProgressRoot';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';
/**
 * A text label displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressValue(componentProps: ProgressValue.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, ['children']);

  const { value, formattedValue, state } = useProgressRootContext();

  // Follow `status` rather than re-deriving it: a non-finite `value` is also indeterminate, and
  // has no formatted text to show.
  const indeterminate = () => state.status === 'indeterminate';
  const formattedValueArg = () => (indeterminate() ? 'indeterminate' : formattedValue());
  const formattedValueDisplay = () => (indeterminate() ? null : formattedValue());

  const element = useRenderElement('span', componentProps, {
    state,
    get children() {
      const children = componentProps.children;
      return (
        <>
          {typeof children === 'function'
            ? children(formattedValueArg(), value())
            : formattedValueDisplay()}
        </>
      );
    },
    props: [{ 'aria-hidden': 'true' }, elementProps],
    stateAttributesMapping: progressStateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface ProgressValueState extends ProgressRootState {}

export interface ProgressValueProps extends Omit<
  BaseUIComponentProps<'span', ProgressValueState>,
  'children'
> {
  children?:
    (null | ((formattedValue: string | null, value: number | null) => JSX.Element)) | undefined;
}

export namespace ProgressValue {
  export type State = ProgressValueState;
  export type Props = ProgressValueProps;
}
