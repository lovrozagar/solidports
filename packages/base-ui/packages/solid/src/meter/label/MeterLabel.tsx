import { createTrackedEffect, onCleanup } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import type { MeterRoot } from '../root/MeterRoot';
import { useMeterRootContext } from '../root/MeterRootContext';

/**
 * An accessible label for the meter.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterLabel(componentProps: MeterLabel.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['id']);
  const id = useBaseUiId(() => local.id);

  const { setLabelId } = useMeterRootContext();

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    setLabelId(id());
    _c.push(() => setLabelId(undefined));
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  const element = useRenderElement('span', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
        role: 'presentation',
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface MeterLabelProps extends BaseUIComponentProps<'span', MeterRoot.State> {}

export namespace MeterLabel {
  export type Props = MeterLabelProps;
}
