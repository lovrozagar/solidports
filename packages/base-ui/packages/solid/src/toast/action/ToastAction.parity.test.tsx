/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Parity for Toast.Action on the native path (D32's sweep): live toasts render their actions
 * natively, then, alone, forced onto the slow path (`part`), and the two must produce the same
 * normalized document and the same handler calls after each step. The toast's `actionProps` win
 * over the consumer's props, and `toast().update()` changes them on a live toast: attributes, a
 * handler swap, children, and `actionProps` going from present to absent and back.
 */
import { flush, For } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Toast } from '@solidports/base-ui/toast';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../../test/parityHarness';
import { renderPathOf } from '../../utils/renderPath';

type Step = () => void;
type Manager = ReturnType<typeof Toast.createToastManager>;

/**
 * The document with each `style` attribute's declarations sorted: the native kit writes a part
 * style first and the consumer's over it, the slow path's merge starts from the consumer's, so
 * the same declarations can come in another order (the computed style is the same).
 */
function snapshot() {
  return normalizeTree(document.body)
    .replace(/mui-cl-\d+/g, 'mui-cl-#')
    .replace(
      /style="([^"]*)"/g,
      (_, declarations: string) =>
        `style="${declarations
          .split(';')
          .map((declaration) => declaration.trim())
          .filter(Boolean)
          .sort()
          .join('; ')}"`,
    );
}

const action = (id: string) =>
  document.querySelector<HTMLElement>(`[data-toast="${id}"] [data-action]`);

describe('native parity: toast actions', () => {
  const { render } = createRenderer();

  async function snapshots(slow: boolean, steps: (manager: Manager, events: string[]) => Step[]) {
    const manager = Toast.createToastManager();
    const events: string[] = [];
    function List() {
      const { toasts } = Toast.useToastManager();
      return (
        <For each={toasts()}>
          {(toast) => (
            <Toast.Root toast={toast} data-toast={toast.id}>
              <Toast.Title />
              {part(Toast.Action, slow, 'button', {
                'data-action': '',
                class: 'consumer',
                style: { color: 'red' },
                title: 'consumer title',
                onClick: () => events.push(`consumer-click:${toast.id}`),
                onKeyDown: (event: KeyboardEvent) =>
                  events.push(`consumer-keydown:${toast.id}:${event.key}`),
                // The second toast's action has no children of its own: it renders only while
                // its `actionProps` carry some.
                ...(toast.id === 'plain' ? {} : { children: 'Consumer' }),
                ...(toast.id === 'disabled' ? { disabled: true } : {}),
              })}
            </Toast.Root>
          )}
        </For>
      );
    }
    const view = render(() => (
      <Toast.Provider toastManager={manager} timeout={0}>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
      </Toast.Provider>
    ));
    flush();
    const record = () => {
      const actions = [...document.body.querySelectorAll('[data-action]')];
      expect(actions.map((el) => renderPathOf(el))).not.toContain(slow ? 'native' : 'slow');
      return { tree: snapshot(), events: events.join(',') };
    };
    const trees = [record()];
    for (const step of steps(manager, events)) {
      step();
      flush();
      // eslint-disable-next-line no-await-in-loop -- the steps run in order
      await Promise.resolve();
      flush();
      trees.push(record());
    }
    view.unmount();
    view.container.remove();
    return trees;
  }

  it('Toast.Action renders the same DOM and handler calls through actionProps updates', async () => {
    const steps = (manager: Manager, events: string[]): Step[] => [
      () =>
        manager.add({
          id: 'live',
          title: 'Saved',
          actionProps: {
            children: 'Undo',
            id: 'action-1',
            class: 'action',
            style: { margin: '1px', color: 'blue' },
            'data-extra': '1',
            onClick: () => events.push('action-click:1'),
          } as never,
        }),
      () => fireEvent.click(action('live')!),
      () => fireEvent.keyDown(action('live')!, { key: 'Enter' }),
      // A handler swap, new children, a new attribute and a dropped one.
      () =>
        manager.update('live', {
          actionProps: {
            children: 'Redo',
            title: 'action title',
            onClick: () => events.push('action-click:2'),
            onKeyDown: (event: KeyboardEvent & { preventBaseUIHandler?: () => void }) => {
              events.push(`action-keydown:${event.key}`);
              event.preventBaseUIHandler?.();
            },
          } as never,
        }),
      () => fireEvent.click(action('live')!),
      () => fireEvent.keyDown(action('live')!, { key: 'Enter' }),
      // Absent: the consumer's props come back.
      () => manager.update('live', { actionProps: undefined }),
      () => fireEvent.click(action('live')!),
      () => manager.update('live', { actionProps: { 'aria-label': 'again' } as never }),
      // An action with no children renders only while `actionProps` carry some.
      () => manager.add({ id: 'plain', title: 'Plain' }),
      () => manager.update('plain', { actionProps: { children: 'Act' } as never }),
      () => fireEvent.click(action('plain')!),
      () => manager.update('plain', { actionProps: undefined }),
      () =>
        manager.add({
          id: 'disabled',
          title: 'Disabled',
          actionProps: {
            onClick: () => events.push('action-click:disabled'),
            onPointerDown: () => events.push('action-pointerdown:disabled'),
          } as never,
        }),
      () => fireEvent.click(action('disabled')!),
      () => fireEvent.keyDown(action('disabled')!, { key: 'Enter' }),
      // A disabled button still gets a pointerdown: the gate cancels it and runs no handler.
      () => events.push(`pointerdown-prevented:${!fireEvent.pointerDown(action('disabled')!)}`),
      // The source drops the `disabled` attribute; the consumer's `disabled` still gates the
      // button's handlers, as `useButton` reads only the consumer's.
      () =>
        manager.update('disabled', {
          actionProps: {
            disabled: false,
            onClick: () => events.push('action-click:enabled-attribute'),
          } as never,
        }),
      () => events.push(`click-prevented:${!fireEvent.click(action('disabled')!)}`),
    ];
    const native = await snapshots(false, steps);
    const slow = await snapshots(true, steps);
    expect(native).toEqual(slow);
  });
});
