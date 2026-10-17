import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/constants';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { MeterRootState } from '../root/MeterRoot';
import { useMeterRootContext } from '../root/MeterRootContext';

/** The indicator's element: a `<div>`; the server renders the same tag. */
const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };

/** The part has no props of its own. */
const OWN_KEYS: ReadonlySet<string> = new Set();

/**
 * Visualizes the position of the value along the range.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterIndicator(componentProps: MeterIndicator.Props) {
  const percentageValue = useMeterRootContext().percentageValue;

  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX, on the client, the server and while hydrating; the fill is a part style below the
  // consumer's. The indicator has no state attributes, and `class`/`style` functions receive an
  // empty state, as on the slow path.
  if (canRenderNative(componentProps, undefined, true)) {
     
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state: EMPTY_OBJECT as MeterIndicator.State,
      stateAttributes: false,
      reactive: true,
      partStyle: () => fillStyle(percentageValue()),
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        get style(): JSX.CSSProperties {
          return fillStyle(percentageValue());
        },
      },
      elementProps,
    ],
  });

  return element();
}

/** The indicator's fill for a percentage. */
function fillStyle(percentage: number): JSX.CSSProperties {
  return { 'inset-inline-start': 0, height: 'inherit', width: `${percentage}%` };
}

export interface MeterIndicatorState extends MeterRootState {}

export interface MeterIndicatorProps extends BaseUIComponentProps<'div', MeterIndicatorState> {}

export namespace MeterIndicator {
  export type State = MeterIndicatorState;
  export type Props = MeterIndicatorProps;
}
