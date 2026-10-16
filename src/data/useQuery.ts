/**
 * Хук подписки на ключ слоя данных (ТЗ § 5, Д3, Д9).
 *
 * Хук не знает про axios: получает key + fetcher из services/api.
 * Схема показа — stale-while-revalidate: кэшированные данные отдаются сразу,
 * обновление идёт в фоне; ошибка не стирает последние успешные данные.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isOffline, type ApiError } from './apiErrors';
import { keyToString, type QueryKey } from './keys';
import { queryClient, type QueryOptions } from './queryClient';

export interface QueryState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  /** нет данных и идёт первая загрузка */
  isLoading: boolean;
  /** идёт любая загрузка, в том числе фоновая */
  isFetching: boolean;
  isStale: boolean;
  updatedAt: number | undefined;
  /** последняя ошибка — сетевая (нет связи) */
  isOffline: boolean;
  refetch: (opts?: { force?: boolean }) => Promise<void>;
}

export function useQuery<T>(
  key: QueryKey,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions,
): QueryState<T> {
  const keyString = keyToString(key);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyRef = useRef<QueryKey>(key);
  keyRef.current = key;

  // Запись должна существовать до чтения снапшота (useSyncExternalStore читает во время рендера).
  queryClient.ensure(key, (signal) => fetcherRef.current(signal) as Promise<unknown>);

  const version = useSyncExternalStore(
    useCallback((listener: () => void) => queryClient.subscribe(keyString, listener), [keyString]),
    useCallback(() => queryClient.getVersion(keyString), [keyString]),
    useCallback(() => queryClient.getVersion(keyString), [keyString]),
  );

  const enabled = options.enabled !== false;
  const ttl = options.ttl;
  const pollInterval = options.pollInterval;
  const refetchOnMount = options.refetchOnMount ?? 'if-stale';

  // Настройки ключа (TTL, интервал опроса) регистрируются в слое — экраны их не задают.
  useEffect(() => {
    queryClient.setOptions(keyRef.current, {
      ttl,
      pollInterval,
      refetchOnMount,
      refetchOnFocus: options.refetchOnFocus,
      enabled,
    });
  }, [keyString, ttl, pollInterval, refetchOnMount, enabled, options.refetchOnFocus]);

  // Подписчик: отмена запроса происходит при уходе последнего подписчика (Д9).
  useEffect(() => {
    if (!enabled) return undefined;
    return queryClient.addSubscriber(keyRef.current);
  }, [keyString, enabled]);

  // Загрузка при монтировании/смене ключа.
  useEffect(() => {
    if (!enabled || refetchOnMount === 'never') return;
    if (refetchOnMount === 'always') {
      void queryClient.refetch([keyRef.current], { force: true });
      return;
    }
    if (queryClient.isStale(keyRef.current)) {
      void queryClient.refetch([keyRef.current]);
    }
  }, [keyString, enabled, refetchOnMount]);

  const entry = queryClient.getEntryByString(keyString);
  const data = entry?.data as T | undefined;
  const error = entry?.error as ApiError | undefined;
  const isFetching = entry?.fetching ?? false;
  const updatedAt = entry?.updatedAt;
  // version в замыкании не нужен, но её изменение перерисовывает компонент и пересчитывает свежесть
  void version;
  const isStale =
    !entry || entry.updatedAt === undefined || entry.invalidated || Date.now() - entry.updatedAt > ttl;

  const refetch = useCallback(
    (opts?: { force?: boolean }) => queryClient.refetch([keyRef.current], opts),
    [],
  );

  return {
    data,
    error,
    isLoading: data === undefined && isFetching,
    isFetching,
    isStale,
    updatedAt,
    isOffline: isOffline(error),
    refetch,
  };
}

/**
 * Версия набора ключей одним числом (примитив → годится для useSyncExternalStore).
 * Нужна там, где один хук читает много ключей сразу (например вероятности ограбления).
 */
export function useKeysVersion(keyStrings: string[]): number {
  const joined = keyStrings.join('|');
  const stringsRef = useRef(keyStrings);
  stringsRef.current = keyStrings;

  return useSyncExternalStore(
    useCallback((listener: () => void) => queryClient.subscribeMany(joined ? joined.split('|') : [], listener), [joined]),
    useCallback(() => queryClient.getManyVersion(joined ? joined.split('|') : []), [joined]),
    useCallback(() => queryClient.getManyVersion(joined ? joined.split('|') : []), [joined]),
  );
}

/** Глобальное состояние связи: время последнего успешного запроса и признак «нет связи». */
export function useConnectionState(): {
  lastSuccessAt: number | undefined;
  isOffline: boolean;
  connectionVersion: number;
} {
  const connectionVersion = useSyncExternalStore(
    useCallback((listener: () => void) => queryClient.subscribeConnection(listener), []),
    useCallback(() => queryClient.getConnectionVersion(), []),
    useCallback(() => queryClient.getConnectionVersion(), []),
  );

  return {
    lastSuccessAt: queryClient.getLastSuccessAt(),
    isOffline: queryClient.isConnectionOffline(),
    connectionVersion,
  };
}

/** Значение «сейчас», обновляемое по таймеру — для надписей «обновлено N назад». */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs <= 0) return undefined;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (disposed) return;
      setNow(Date.now());
      timer = setTimeout(tick, intervalMs);
    };
    timer = setTimeout(tick, intervalMs);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs]);

  return now;
}

