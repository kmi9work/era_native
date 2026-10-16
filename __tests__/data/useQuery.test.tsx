/**
 * Тесты хука useQuery (ТЗ § 9): stale-while-revalidate, ошибка не стирает
 * последние данные и выставляет «нет связи», force игнорирует TTL.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiErrorException } from '../../src/data/apiErrors';
import { queryKeys } from '../../src/data/keys';
import { queryClient } from '../../src/data/queryClient';
import { useQuery } from '../../src/data/useQuery';

const renderHook = <T,>(hook: () => T) => {
  const result: { current: T } = { current: undefined as unknown as T };
  const Component = () => {
    result.current = hook();
    return null;
  };

  let tree: ReactTestRenderer;
  act(() => {
    tree = create(<Component />);
  });

  return {
    get current() {
      return result.current;
    },
    unmount: () => act(() => tree.unmount()),
  };
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const settle = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

describe('useQuery', () => {
  beforeEach(() => {
    queryClient.reset();
  });

  afterEach(() => {
    queryClient.reset();
  });

  it('SWR: кэшированные данные видны сразу, обновление идёт в фоне', async () => {
    const key = queryKeys.guilds();
    queryClient.setQueryData(key, [{ id: 0, name: 'Старая' }]);

    const pending = deferred<unknown[]>();
    const fetcher = jest.fn(() => pending.promise);

    const hook = renderHook(() =>
      useQuery<unknown[]>(key, fetcher, { ttl: 60_000, refetchOnMount: 'always' }),
    );

    // данные из кэша показаны, спиннера первой загрузки нет
    expect(hook.current.data).toEqual([{ id: 0, name: 'Старая' }]);
    expect(hook.current.isLoading).toBe(false);
    expect(hook.current.isFetching).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);

    pending.resolve([{ id: 1, name: 'Новая' }]);
    await settle();

    expect(hook.current.data).toEqual([{ id: 1, name: 'Новая' }]);
    expect(hook.current.isFetching).toBe(false);
    expect(hook.current.updatedAt).toBeGreaterThan(0);

    hook.unmount();
  });

  it('ошибка не стирает предыдущие данные и выставляет признак «нет связи»', async () => {
    const key = queryKeys.countries();
    const previous = [{ id: 5, name: 'Русь' }];
    queryClient.setQueryData(key, previous);

    const fetcher = jest.fn(async () => {
      throw new ApiErrorException('network', 'Нет соединения с сервером');
    });

    const hook = renderHook(() =>
      useQuery<unknown[]>(key, fetcher, { ttl: 60_000, refetchOnMount: 'always' }),
    );

    await settle();

    expect(hook.current.data).toEqual(previous);
    expect(hook.current.isOffline).toBe(true);
    expect(hook.current.error?.kind).toBe('network');
    expect(hook.current.isLoading).toBe(false);

    hook.unmount();
  });

  it('force игнорирует TTL, обычный refetch на свежих данных запрос не шлёт', async () => {
    const key = queryKeys.prices();
    const fetcher = jest.fn(async () => ({ prices: { off_market: [], to_market: [] } }));
    queryClient.setQueryData(key, { prices: { off_market: [{ identificator: 'gold' }], to_market: [] } });

    const hook = renderHook(() => useQuery(key, fetcher, { ttl: 300_000 }));

    expect(fetcher).toHaveBeenCalledTimes(0);

    await act(async () => {
      await hook.current.refetch();
    });
    expect(fetcher).toHaveBeenCalledTimes(0);

    await act(async () => {
      await hook.current.refetch({ force: true });
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    hook.unmount();
  });

  it('ошибка HTTP не помечается как «нет связи»', async () => {
    const key = queryKeys.plant(42);
    const fetcher = jest.fn(async () => {
      throw new ApiErrorException('http', 'Ошибка сервера (500)', 500);
    });

    const hook = renderHook(() => useQuery(key, fetcher, { ttl: 0, refetchOnMount: 'always' }));
    await settle();

    expect(hook.current.isOffline).toBe(false);
    expect(hook.current.error?.status).toBe(500);

    hook.unmount();
  });

  it('снятие подписчика при размонтировании останавливает опрос ключа', async () => {
    jest.useFakeTimers();
    try {
      const key = queryKeys.resources();
      const fetcher = jest.fn(async () => [{ id: 1 }]);

      const hook = renderHook(() =>
        useQuery(key, fetcher, { ttl: 0, pollInterval: 1000, refetchOnMount: 'always' }),
      );

      expect(fetcher).toHaveBeenCalledTimes(1);

      // пока компонент смонтирован (но не в фокусе) опрос не идёт
      jest.advanceTimersByTime(5000);
      expect(fetcher).toHaveBeenCalledTimes(1);

      hook.unmount();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
