import { expectType } from '#test-utils';
import {
  DirectionProvider,
  useDirection,
  type DirectionProviderProps,
  type TextDirection,
} from '@solidports/base-ui/direction-provider';

// Solid: `useDirection` returns an accessor.
const direction = null as unknown as ReturnType<ReturnType<typeof useDirection>>;

expectType<TextDirection, typeof direction>(direction);

const props: DirectionProviderProps = {
  direction: 'rtl',
  children: <div />,
};

expectType<TextDirection | undefined, typeof props.direction>(props.direction);

<DirectionProvider />;
<DirectionProvider direction="ltr" />;
<DirectionProvider direction="rtl" />;

const invalidDirection = (
  // @ts-expect-error
  <DirectionProvider direction="vertical" />
);
