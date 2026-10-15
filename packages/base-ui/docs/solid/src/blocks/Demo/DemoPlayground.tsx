import { createMemo, omit, useContext } from 'solid-js';
import { reactRef } from 'docs/src/adapters/react';
import type { PropsWithoutRef, ReactProps, Ref } from 'docs/src/adapters/react';
import type { JSX } from '@solidjs/web';
import { DemoContext } from './DemoContext';

export const DemoPlayground = function DemoPlayground(
  _props: PropsWithoutRef<DemoPlayground.Props> & {
    ref?: Ref<HTMLDivElement>;
  },
) {
  const props = omit(_props, 'ref');
  const demoContext = useContext(DemoContext);
  const _render = createMemo(() => {
    const _demoContext = demoContext();
    if (!_demoContext) {
      throw new Error('Demo.Playground must be used within a Demo.Root');
    }
    const { selectedVariant } = _demoContext;
    const { component: DemoComponent } = selectedVariant;
    return (
      <div {...props} ref={reactRef(_props.ref)}>
        <DemoComponent />
      </div>
    );
  });
  return <>{_render()}</>;
};
export namespace DemoPlayground {
  export interface Props extends ReactProps<JSX.HTMLAttributes<HTMLDivElement>> {
    class?: string;
  }
}
