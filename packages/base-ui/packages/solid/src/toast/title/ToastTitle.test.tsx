import { describe } from 'vitest';
import { Toast } from '@solidports/base-ui/toast';
import { createRenderer, describeConformance } from '#test-utils';

const toast = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Title />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props: Toast.Title.Props) => <Toast.Title {...props}>title</Toast.Title>,
    () => ({
      refInstanceof: window.HTMLHeadingElement,
      render(node, props) {
        return render(() => (
          <Toast.Provider>
            <Toast.Viewport>
              <Toast.Root toast={toast}>{node(props!)}</Toast.Root>
            </Toast.Viewport>
          </Toast.Provider>
        ));
      },
    }),
  );
});
