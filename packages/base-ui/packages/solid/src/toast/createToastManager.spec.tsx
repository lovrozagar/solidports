import { expectType } from '#test-utils';
import { createToastManager } from './createToastManager';

type ToastPayload = {
  id: string;
  count: number;
};

const typedManager = createToastManager<ToastPayload>();

const typedAddId = typedManager.add({
  data: {
    count: 1,
    id: 'typed',
  },
  title: 'typed',
});
expectType<string, typeof typedAddId>(typedAddId);

typedManager.add({
  data: {
    id: 'test',
    // @ts-expect-error - message is not a valid property
    message: 'not a number',
  },
  title: 'wrong-shape',
});

typedManager.add({
  title: 'wrong-shape',
  // @ts-expect-error - count is a missing property
  data: {
    id: 'test',
  },
});

typedManager.update('typed', {
  data: {
    count: 2,
    id: 'typed-update',
  },
});

typedManager.promise(Promise.resolve(2), {
  error: 'error',
  loading: 'loading',
  success: (value) => ({
    title: `${value}`,
    data: {
      id: 'typed-success',
      count: value,
    },
  }),
});

const legacyManager = createToastManager();

const legacyAddId = legacyManager.add<ToastPayload>({
  data: {
    count: 3,
    id: 'legacy',
  },
  title: 'legacy',
});
expectType<string, typeof legacyAddId>(legacyAddId);

legacyManager.update<ToastPayload>('legacy', {
  data: {
    count: 4,
    id: 'legacy-update',
  },
});

legacyManager.promise<number, ToastPayload>(Promise.resolve(5), {
  error: 'error',
  loading: 'loading',
  success: (value) => ({
    title: `${value}`,
    data: {
      id: 'legacy-success',
      count: value,
    },
  }),
});
