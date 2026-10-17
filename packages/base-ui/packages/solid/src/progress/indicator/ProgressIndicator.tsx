import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { ProgressRootState } from '../root/ProgressRoot';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping, writeProgressState } from '../root/stateAttributesMapping';

/** The indicator's element: a `<div>`; the server renders the same tag. */
const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };

/** The part has no props of its own. */
const OWN_KEYS: ReadonlySet<string> = new Set();

/**
 * Visualizes the completion status of the task.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressIndicator(componentProps: ProgressIndicator.Props) {
  const context = useProgressRootContext();
  const percentageValue = context.percentageValue;

  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX, on the client, the server and while hydrating; the fill is a part style below the
  // consumer's.
  if (canRenderNative(componentProps, undefined, true)) {
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state: context.state,
      stateWriter: writeProgressState,
      mapping: progressStateAttributesMapping,
      reactive: true,
      partStyle: () => fillStyle(percentageValue()),
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);
  const state = context.state;

  const element = useRenderElement('div', componentProps, {
    state,
    props: [
      {
        get style(): JSX.CSSProperties | undefined {
          return fillStyle(percentageValue());
        },
      },
      elementProps,
    ],
    stateAttributesMapping: progressStateAttributesMapping,
  });

  return <>{element()}</>;
}

/**
 * The indicator's fill for a percentage; none while indeterminate. React renders upstream's empty
 * style object as no attribute, which `undefined` is in Solid (an empty object writes `style=""`).
 */
function fillStyle(percentage: number | null): JSX.CSSProperties | undefined {
  return percentage == null
    ? undefined
    : { 'inset-inline-start': 0, height: 'inherit', width: `${percentage}%` };
}

export interface ProgressIndicatorState extends ProgressRootState {}

export interface ProgressIndicatorProps extends BaseUIComponentProps<
  'div',
  ProgressIndicatorState
> {}

export namespace ProgressIndicator {
  export type State = ProgressIndicatorState;
  export type Props = ProgressIndicatorProps;
}
