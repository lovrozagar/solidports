/* eslint-disable testing-library/no-container -- compares the rendered documents directly */
/*
 * Parity for the Toast parts D32's sweep put on the native path (Root, Content, Title, Description
 * and Close): one toast tree renders through the native paths, then, alone, with those parts forced
 * onto the slow path (`part`), and the two must produce the same normalized document after each
 * step that changes the toasts: adding, updating, focusing a close button, expanding the stack,
 * going over the limit and closing a toast.
 */
import { flush, For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Toast } from '@solidports/base-ui/toast';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../test/parityHarness';
import { renderPathOf } from '../utils/renderPath';

type Manager = ReturnType<typeof Toast.createToastManager>;
type Step = (body: HTMLElement, manager: Manager) => void;

/** The normalized body, generated ids renumbered as `normalizeTree` renumbers part ids. */
function snapshot(body: HTMLElement) {
  const ids = new Map<string, string>();
  return normalizeTree(body).replace(/mui-[A-Za-z0-9-]+/g, (id) => {
    if (!ids.has(id)) {
      ids.set(id, `mui-#${ids.size}`);
    }
    return ids.get(id)!;
  });
}

function ToastList(props: { slow: boolean }) {
  const { toasts } = Toast.useToastManager();
  return (
    <For each={toasts()}>
      {(toast) =>
        part(Toast.Root, props.slow, 'div', {
          toast,
          'data-testid': 'root',
          get children() {
            return part(Toast.Content, props.slow, 'div', {
              get children() {
                return [
                  part(Toast.Title, props.slow, 'h2', {}),
                  part(Toast.Description, props.slow, 'p', {}),
                  part(Toast.Close, props.slow, 'button', {
                    'data-testid': 'close',
                    children: 'Dismiss',
                  }),
                ];
              },
            });
          },
        })
      }
    </For>
  );
}

describe('native parity: toast parts', () => {
  const { render } = createRenderer();

  /** The normalized document after each step, for one path. */
  function snapshots(slow: boolean, steps: Step[]) {
    const manager = Toast.createToastManager();
    const view = render(
      (): JSX.Element => (
        <Toast.Provider toastManager={manager} timeout={0} limit={2}>
          <Toast.Viewport data-testid="viewport">
            <ToastList slow={slow} />
          </Toast.Viewport>
        </Toast.Provider>
      ),
    );
    flush();
    const body = document.body;
    const trees: string[] = [];
    for (const step of steps) {
      step(body, manager);
      flush();
      trees.push(snapshot(body));
    }
    const paths = [...body.querySelectorAll('[data-testid="root"] *, [data-testid="root"]')].map(
      (el) => renderPathOf(el),
    );
    // Each tree took the path it stands for.
    if (slow) {
      expect(paths).not.toContain('native');
    } else {
      expect(paths).not.toContain('slow');
    }
    view.unmount();
    view.container.remove();
    return trees;
  }

  it('Toast parts render the same DOM through adding, updating, focusing, expanding, limiting and closing', () => {
    const closeButtons = (body: HTMLElement) =>
      [...body.querySelectorAll('[data-testid="close"]')] as HTMLElement[];
    const steps: Step[] = [
      (_, manager) => {
        manager.add({ id: 'a', title: 'First', description: 'One' });
      },
      (_, manager) => {
        manager.add({ id: 'b', title: 'Second', type: 'success', priority: 'high' });
      },
      (_, manager) => {
        manager.update('a', { description: 'Updated', type: 'error' });
      },
      // Focused while the stack is collapsed: the close button is no longer hidden.
      (body) => {
        fireEvent.focus(closeButtons(body)[0]);
      },
      (body) => {
        fireEvent.blur(closeButtons(body)[0]);
      },
      (body) => {
        fireEvent.mouseEnter(body.querySelector('[data-testid="viewport"]')!);
      },
      (_, manager) => {
        manager.add({ id: 'c', description: 'Third, over the limit' });
      },
      (body) => {
        fireEvent.click(closeButtons(body)[0]);
      },
    ];
    expect(snapshots(false, steps)).toEqual(snapshots(true, steps));
  });
});
