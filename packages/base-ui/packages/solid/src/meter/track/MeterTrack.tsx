import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/constants';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { MeterRootState } from '../root/MeterRoot';

/** The track's element: a `<div>`; the server renders the same tag. */
const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };

/** The part has no props of its own. */
const OWN_KEYS: ReadonlySet<string> = new Set();

/**
 * Contains the meter indicator and represents the entire range of the meter.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterTrack(componentProps: MeterTrack.Props) {
  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX, on the client, the server and while hydrating. The track has no state attributes, and
  // `class`/`style` functions receive an empty state, as on the slow path.
  if (canRenderNative(componentProps, undefined, true)) {
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state: EMPTY_OBJECT as MeterTrack.State,
      stateAttributes: false,
      reactive: false,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const element = useRenderElement('div', componentProps, {
    props: elementProps,
  });

  return <>{element()}</>;
}

export interface MeterTrackState extends MeterRootState {}

export interface MeterTrackProps extends BaseUIComponentProps<'div', MeterTrackState> {}

export namespace MeterTrack {
  export type State = MeterTrackState;
  export type Props = MeterTrackProps;
}
