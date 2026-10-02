import { createRenderer, flushMicrotasks, isJSDOM } from '#test-utils';
import { Toast } from '@solidports/base-ui/toast';
import { fireEvent, screen } from '@solidjs/testing-library';
import { expect, vi } from 'vitest';
import { List } from './utils/test-utils';
import type { ToastObject } from './useToastManager';

describe.skipIf(!isJSDOM)('createToastManager', () => {
  const { render, clock } = createRenderer();

  clock.withFakeTimers();

  describe('add', () => {
    it('adds a toast', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.add({
          title: 'title',
        });
      }

      function AddButton() {
        return (
          <button type="button" onClick={add}>
            add
          </button>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>
      ));

      expect(screen.queryByTestId('title')).to.equal(null);

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      expect(screen.queryByTestId('title')).not.to.equal(null);

      await clock.tickAsync(5000);

      expect(screen.queryByTestId('title')).to.equal(null);
    });

    it('returns a toast id', async () => {
      const toastManager = Toast.createToastManager();

      const toastId = toastManager.add({
        title: 'title',
      });

      expect(toastId).to.be.a('string');
    });

    it('upserts a toast when adding with an existing id', async () => {
      const toastManager = Toast.createToastManager();
      let firstToastId = '';
      let secondToastId = '';

      function Buttons() {
        return (
          <>
            <button
              type="button"
              onClick={() => {
                firstToastId = toastManager.add({
                  id: 'save',
                  title: 'Saving…',
                  timeout: 1000,
                });
              }}
            >
              add
            </button>
            <button
              type="button"
              onClick={() => {
                secondToastId = toastManager.add({
                  id: 'save',
                  title: 'Saved',
                  timeout: 1000,
                });
              }}
            >
              upsert
            </button>
          </>
        );
      }

      await render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('title')).toHaveTextContent('Saving…');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);

      await clock.tickAsync(900);

      fireEvent.click(screen.getByRole('button', { name: 'upsert' }));

      expect(firstToastId).toBe('save');
      expect(secondToastId).toBe(firstToastId);
      expect(screen.getByTestId('title')).toHaveTextContent('Saved');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);

      await clock.tickAsync(200);
      expect(screen.queryByTestId('title')).not.toBe(null);

      await clock.tickAsync(800);
      expect(screen.queryByTestId('title')).toBe(null);
    });
  });

  describe('promise', () => {
    it('adds a toast with the loading state that is updated with the success state', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.promise(
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('success');
            }, 1000);
          }),
          {
            error: 'error',
            loading: 'loading',
            success: 'success',
          },
        );
      }

      function AddButton() {
        return (
          <button type="button" onClick={add}>
            add
          </button>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>
      ));

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);
      await flushMicrotasks();

      expect(screen.queryByTestId('description')).to.have.text('loading');

      await clock.tickAsync(1000);

      expect(screen.queryByTestId('description')).to.have.text('success');
    });

    it('does not inherit a loading timeout when success does not specify one', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.promise(
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('success');
            }, 1000);
          }),
          {
            error: 'error',
            loading: {
              description: 'loading',
              timeout: 0,
            },
            success: {
              description: 'success',
            },
          },
        );
      }

      function AddButton() {
        return (
          <button type="button" onClick={add}>
            add
          </button>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      await flushMicrotasks();

      expect(screen.queryByTestId('description')).to.have.text('loading');

      await clock.tickAsync(1000);

      expect(screen.queryByTestId('description')).to.have.text('success');

      await clock.tickAsync(5000);

      expect(screen.queryByTestId('description')).to.equal(null);
    });

    it('adds a toast with the loading state that is updated with the error state', async () => {
      const toastManager = Toast.createToastManager();

      function promise() {
        toastManager
          .promise(
            new Promise((res, rej) => {
              rej(new Error('error'));
            }),
            {
              error: 'error',
              loading: 'loading',
              success: 'success',
            },
          )
          .catch(() => {
            // Swallow the error
          });
      }

      function AddButton() {
        return (
          <button type="button" onClick={promise}>
            add
          </button>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>
      ));

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);
      await flushMicrotasks();

      expect(screen.getByTestId('description')).to.have.text('error');
    });

    it('does not reopen a dismissed promise toast when it resolves', async () => {
      const toastManager = Toast.createToastManager();
      let resolvePromise: (value: string) => void = () => {
        throw new Error('Promise resolver should be assigned before resolving.');
      };

      function add() {
        const pendingPromise = new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });

        toastManager.promise(pendingPromise, {
          error: 'error',
          loading: 'loading',
          success: 'success',
        });
      }

      function Button() {
        return (
          <button type="button" onClick={add}>
            add
          </button>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('description')).to.have.text('loading');

      fireEvent.click(screen.getByLabelText('close-press'));
      resolvePromise('success');

      await flushMicrotasks();

      expect(screen.queryByTestId('title')).to.equal(null);
    });
  });

  describe('update', () => {
    it('updates a toast', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
        });
      }

      function update() {
        toastManager.update(toastId, {
          title: 'updated',
        });
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      const updateButton = screen.getByRole('button', { name: 'update method' });
      fireEvent.click(updateButton);

      expect(screen.getByTestId('title')).to.have.text('updated');
    });

    it('derives the update from the current toast when given a function', async () => {
      const toastManager = Toast.createToastManager<{ count: number }>();

      let toastId: string;
      const updater = vi.fn((prevToast: ToastObject<{ count: number }>) => ({
        title: `${prevToast.title} updated`,
        data: { count: prevToast.data!.count + 1 },
      }));

      function add() {
        toastId = toastManager.add({ title: 'title', data: { count: 1 } });
      }

      function update() {
        toastManager.update(toastId, updater);
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </>
        );
      }

      await render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      fireEvent.click(screen.getByRole('button', { name: 'update method' }));

      expect(updater).toHaveBeenCalledTimes(1);
      expect(updater.mock.calls[0][0].data).toEqual({ count: 1 });
      expect(screen.getByTestId('title')).toHaveTextContent('title updated');
    });

    it('resets the auto-dismiss timer when updating with the same timeout value', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          timeout: 1000,
          title: 'title',
        });
      }

      function resetTimeout() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={resetTimeout}>
              reset timeout
            </button>
          </>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('title')).not.to.equal(null);

      await clock.tickAsync(900);
      expect(screen.queryByTestId('title')).not.to.equal(null);

      console.log('after 900ms');
      fireEvent.click(screen.getByRole('button', { name: 'reset timeout' }));

      await clock.tickAsync(200);
      console.log('after 1100ms');
      expect(screen.queryByTestId('title')).not.to.equal(null);

      await clock.tickAsync(800);
      expect(screen.queryByTestId('title')).to.equal(null);
    });

    it('resets the auto-dismiss timer when updating from 0 to a timeout, then updating with the same timeout again', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          timeout: 0,
          title: 'title',
        });
      }

      function setTimeoutTo1000() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      function resetTimeoutTo1000() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={setTimeoutTo1000}>
              set timeout
            </button>
            <button type="button" onClick={resetTimeoutTo1000}>
              reset timeout
            </button>
          </>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('title')).not.to.equal(null);

      fireEvent.click(screen.getByRole('button', { name: 'set timeout' }));

      await clock.tickAsync(900);
      expect(screen.queryByTestId('title')).not.to.equal(null);

      fireEvent.click(screen.getByRole('button', { name: 'reset timeout' }));

      await clock.tickAsync(200);
      expect(screen.queryByTestId('title')).not.to.equal(null);

      await clock.tickAsync(800);
      expect(screen.queryByTestId('title')).to.equal(null);
    });

    it('auto-dismisses when updating timeout from 0 to a positive value', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          timeout: 0,
          title: 'title',
        });
      }

      function update() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('title')).not.to.equal(null);

      fireEvent.click(screen.getByRole('button', { name: 'update method' }));
      await clock.tickAsync(1000);

      expect(screen.queryByTestId('title')).to.equal(null);
    });

    it('schedules a timer when updating a loading toast to a non-loading type', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'loading',
          type: 'loading',
        });
      }

      function update() {
        toastManager.update(toastId, {
          timeout: 1000,
          title: 'success',
          type: 'success',
        });
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).to.have.text('loading');

      fireEvent.click(screen.getByRole('button', { name: 'update method' }));
      expect(screen.getByTestId('title')).to.have.text('success');

      await clock.tickAsync(1000);

      expect(screen.queryByTestId('title')).to.equal(null);
    });

    it('does not clear the auto-dismiss timer when updated twice before a re-render', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'loading',
          type: 'loading',
        });
      }

      function doubleUpdate() {
        toastManager.update(toastId, {
          timeout: 1000,
          type: 'success',
        });

        toastManager.update(toastId, {
          title: 'new',
        });
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={doubleUpdate}>
              double update
            </button>
          </>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).to.have.text('loading');

      fireEvent.click(screen.getByRole('button', { name: 'double update' }));
      expect(screen.getByTestId('title')).to.have.text('new');

      await clock.tickAsync(1000);

      expect(screen.queryByTestId('title')).to.equal(null);
    });
  });

  describe('close', () => {
    it('closes a toast', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
        });
      }

      function close() {
        toastManager.close(toastId);
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={close}>
              close
            </button>
          </>
        );
      }

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      const closeButton = screen.getByRole('button', { name: 'close' });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('title')).to.equal(null);
    });

    it('closes all toasts', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.add({ title: 'title' });
      }

      function close() {
        toastManager.close();
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={close}>
              close
            </button>
          </>
        );
      }

      await render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      const button = screen.getByRole('button', { name: 'add' });
      Array.from({ length: 5 }).forEach(() => {
        fireEvent.click(button);
      });

      const closeButton = screen.getByRole('button', { name: 'close' });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('does not call onClose when closing toasts that are already ending', async () => {
      const toastManager = Toast.createToastManager();
      const onCloseSpy1 = vi.fn(() => {
        toastManager.close();
      });
      const onCloseSpy2 = vi.fn();
      let toastId1: string;

      function add() {
        toastId1 = toastManager.add({
          title: 'toast 1',
          onClose: onCloseSpy1,
        });

        toastManager.add({
          title: 'toast 2',
          onClose: onCloseSpy2,
        });
      }

      function close() {
        toastManager.close(toastId1);
      }

      function Buttons() {
        return (
          <>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={close}>
              close
            </button>
          </>
        );
      }

      await render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>
      ));

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      fireEvent.click(screen.getByRole('button', { name: 'close' }));

      expect(onCloseSpy1.mock.calls.length).toBe(1);
      expect(onCloseSpy2.mock.calls.length).toBe(1);
    });
  });

  describe('promise rejection identity', () => {
    /* Bug 6 regression: store used `return Promise.reject(error)` in .catch handler.
     * Post-fix uses `throw error`. Both reject, but the identity test proves no wrapping. */
    it('manager.promise rethrows the original rejection (same identity, not wrapped)', async () => {
      const toastManager = Toast.createToastManager();
      const failure = new Error('boom');

      render(() => (
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
        </Toast.Provider>
      ));

      await expect(
        toastManager.promise(Promise.reject(failure), {
          error: () => ({ title: 'err' }),
          loading: { title: 'load' },
          success: () => ({ title: 'ok' }),
        }),
      ).rejects.toBe(failure);
    });
  });
});
