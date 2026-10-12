import { createRenderer, describeConformance } from '#test-utils';
import { Toast } from '@solidports/base-ui/toast';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Description />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props: any) => (
      <Toast.Description {...props} ref={props.ref}>
        description
      </Toast.Description>
    ),
    () => ({
      refInstanceof: window.HTMLParagraphElement,
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
