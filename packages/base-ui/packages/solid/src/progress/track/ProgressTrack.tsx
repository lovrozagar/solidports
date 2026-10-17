import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { ProgressRootState } from '../root/ProgressRoot';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping, writeProgressState } from '../root/stateAttributesMapping';

/** The track's element: a `<div>`; the server renders the same tag. */
const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };

/** The part has no props of its own. */
const OWN_KEYS: ReadonlySet<string> = new Set();

/**
 * Contains the progress bar indicator.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressTrack(componentProps: ProgressTrack.Props) {
  const context = useProgressRootContext();

  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX, on the client, the server and while hydrating.
  if (canRenderNative(componentProps, undefined, true)) {
    // eslint-disable-next-line solid/components-return-once -- the branch is chosen once at setup from information fixed for the part's lifetime
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state: context.state,
      stateWriter: writeProgressState,
      mapping: progressStateAttributesMapping,
      reactive: true,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);
  const state = context.state;

  const element = useRenderElement('div', componentProps, {
    state,
    props: elementProps,
    stateAttributesMapping: progressStateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface ProgressTrackState extends ProgressRootState {}

export interface ProgressTrackProps extends BaseUIComponentProps<'div', ProgressTrackState> {}

export namespace ProgressTrack {
  export type State = ProgressTrackState;
  export type Props = ProgressTrackProps;
}
