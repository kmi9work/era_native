/**
 * Тесты ядра слоя данных (ТЗ § 9): TTL/свежесть, дедупликация, отмена,
 * «последний стартовавший побеждает», точечная инвалидация,
 * backoff при ошибках и снятие опроса при потере фокуса.
 */
import { ApiErrorException } from '../../src/data/apiErrors';
import { queryKeys } from '../../src/data/keys';
import { queryClient } from '../../src/data/queryClient';

const flushMicrotasks = () => Promise.resolve().then(() => undefined);

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('queryClient', () => {
  beforeEach(() => {
    queryClient.reset();
    jest.useRealTimers();
  });

  afterEach(() => {
    queryClient.reset();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('TTL и свежесть', () => {
    it('данные свежие внутри TTL и устаревшие после его истечения', () => {
      jest.useFakeTimers();
      const key = queryKeys.guilds();
      queryClient.ensure(key);
      queryClient.setOptions(key, { ttl: 60_000 });
      queryClient.setQueryData(key, [{ id: 1 }]);

      expect(queryClient.isStale(key)).toBe(false);
      jest.advanceTimersByTime(59_000);
      expect(queryClient.isStale(key)).toBe(false);
      jest.advanceTimersByTime(2_000);
      expect(queryClient.isStale(key)).toBe(true);
    });

    it('ключ без данных считается устаревшим', () => {
      expect(queryClient.isStale(queryKeys.guilds())).toBe(true);
    });

    it('invalidate помечает ключ устаревшим даже при свежем updatedAt', () => {
      const key = queryKeys.countries();
      queryClient.ensure(key);
      queryClient.setOptions(key, { ttl: 300_000 });
      queryClient.setQueryData(key, []);

      queryClient.invalidate([key]);

      expect(queryClient.isStale(key)).toBe(true);
    });

    it('invalidatePrefix трогает только ключи с данным префиксом', () => {
      const plantsOfGuildA = queryKeys.guildPlants(1);
      const plantsOfGuildB = queryKeys.guildPlants(2);
      const countries = queryKeys.countries();

      for (const key of [plantsOfGuildA, plantsOfGuildB, countries]) {
        queryClient.ensure(key);
        queryClient.setOptions(key, { ttl: 300_000 });
        queryClient.setQueryData(key, []);
      }

      queryClient.invalidatePrefix(['guild']);

      expect(queryClient.isStale(plantsOfGuildA)).toBe(true);
      expect(queryClient.isStale(plantsOfGuildB)).toBe(true);
      expect(queryClient.isStale(countries)).toBe(false);
    });
  });

  describe('дедупликация и отмена', () => {
    it('два одновременных force-обновления одного ключа дают один запрос', async () => {
      const key = queryKeys.guilds();
      const fetcher = jest.fn(async () => [{ id: 1 }]);
      queryClient.ensure(key, fetcher);

      await Promise.all([
        queryClient.refetch([key], { force: true }),
        queryClient.refetch([key], { force: true }),
      ]);

      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('молчаливо завершается, когда fetcher для ключа не зарегистрирован', async () => {
      const key = queryKeys.guilds();
      queryClient.ensure(key);

      await expect(queryClient.refetch([key], { force: true })).resolves.toBeUndefined();
      expect(queryClient.getQueryData(key)).toBeUndefined();
    });

    it('уход последнего подписчика отменяет запрос и снимает таймер опроса', async () => {
      const key = queryKeys.plantLevels();
      let aborted = false;
      const fetcher = (signal: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(Object.assign(new Error('canceled'), { name: 'CanceledError' }));
          });
        });

      queryClient.ensure(key, fetcher);
      queryClient.setOptions(key, { ttl: 300_000, pollInterval: 60_000 });
      const unsubscribe = queryClient.addSubscriber(key);
      queryClient.setFocused(key, 1);

      void queryClient.refetch([key], { force: true });
      await flushMicrotasks();

      unsubscribe();
      await flushMicrotasks();

      expect(aborted).toBe(true);

      jest.useFakeTimers();
      jest.advanceTimersByTime(120_000);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('«последний стартовавший побеждает»: ответ устаревшего запроса отбрасывается', async () => {
      jest.useFakeTimers();
      const key = queryKeys.guilds();
      const first = deferred<unknown[]>();
      const second = deferred<unknown[]>();
      let call = 0;
      const fetcher = jest.fn(() => (++call === 1 ? first.promise : second.promise));

      queryClient.ensure(key, fetcher);
      void queryClient.refetch([key], { force: true });
      await flushMicrotasks();

      // выходим за окно дедупликации и стартуем второй запрос по тому же ключу
      jest.advanceTimersByTime(1000);
      void queryClient.refetch([key], { force: true });
      await flushMicrotasks();

      second.resolve([{ id: 2 }]);
      await flushMicrotasks();
      first.resolve([{ id: 1 }]);
      await flushMicrotasks();

      expect(queryClient.getQueryData(key)).toEqual([{ id: 2 }]);
    });
  });

  describe('точечная инвалидация', () => {
    it('invalidate запускает обновление только затронутых ключей и только при подписчике', async () => {
      const guilds = queryKeys.guilds();
      const countries = queryKeys.countries();
      const guildsFetcher = jest.fn(async () => [{ id: 1 }]);
      const countriesFetcher = jest.fn(async () => []);

      queryClient.ensure(guilds, guildsFetcher);
      queryClient.ensure(countries, countriesFetcher);
      queryClient.setQueryData(guilds, [{ id: 0 }]);
      queryClient.setQueryData(countries, []);
      queryClient.setOptions(guilds, { ttl: 300_000 });
      queryClient.setOptions(countries, { ttl: 300_000 });

      const unsubscribe = queryClient.addSubscriber(guilds);
      queryClient.invalidate([guilds]);
      await flushMicrotasks();

      expect(guildsFetcher).toHaveBeenCalledTimes(1);
      expect(countriesFetcher).not.toHaveBeenCalled();
      expect(queryClient.getQueryData(guilds)).toEqual([{ id: 1 }]);

      unsubscribe();
    });
  });

  describe('опрос: backoff при ошибках, сброс при успехе, jitter', () => {
    beforeEach(() => {
      // jitter = ±10 %; фиксируем Math.random по центру, чтобы задержки были точными
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      jest.useFakeTimers();
    });

    it('интервал удваивается при ошибке и возвращается к базовому после успеха', async () => {
      const key = queryKeys.resources();
      let shouldFail = true;
      const fetcher = jest.fn(async () => {
        if (shouldFail) throw new ApiErrorException('network', 'нет связи');
        return [{ id: 1 }];
      });

      queryClient.ensure(key, fetcher);
      queryClient.setOptions(key, { ttl: 0, pollInterval: 1000 });
      queryClient.addSubscriber(key);
      queryClient.setFocused(key, 1);

      // 1-й опрос: базовый интервал 1000 мс
      jest.advanceTimersByTime(1000);
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(1);

      // после ошибки задержка ×2 → 2000 мс
      jest.advanceTimersByTime(1999);
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(2);

      // после второй ошибки задержка ×4 → 4000 мс
      jest.advanceTimersByTime(3999);
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(2);
      jest.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(3);

      // успешный ответ сбрасывает backoff → снова 1000 мс
      shouldFail = false;
      jest.advanceTimersByTime(8000);
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(4);
      expect(queryClient.getQueryData(key)).toEqual([{ id: 1 }]);

      jest.advanceTimersByTime(1000);
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(5);
    });

    it('потеря фокуса снимает таймер опроса (нет фоновых запросов)', async () => {
      const key = queryKeys.prices();
      const fetcher = jest.fn(async () => ({ prices: { off_market: [], to_market: [] } }));

      queryClient.ensure(key, fetcher);
      queryClient.setOptions(key, { ttl: 0, pollInterval: 1000 });
      queryClient.addSubscriber(key);
      queryClient.setFocused(key, 1);

      jest.advanceTimersByTime(1000);
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(1);

      queryClient.setFocused(key, -1);
      expect(jest.getTimerCount()).toBe(0);

      jest.advanceTimersByTime(60_000);
      await flushMicrotasks();
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('без подписчика в фокусе таймер не поднимается', () => {
      const key = queryKeys.robbery(7);
      queryClient.ensure(key);
      queryClient.setOptions(key, { ttl: 30_000, pollInterval: 1000 });

      queryClient.addSubscriber(key);
      expect(jest.getTimerCount()).toBe(0);

      queryClient.setFocused(key, 1);
      expect(jest.getTimerCount()).toBe(1);
    });
  });

  describe('состояние связи', () => {
    it('ошибка сети выставляет признак «нет связи», успех его снимает', async () => {
      const key = queryKeys.guilds();
      let shouldFail = true;
      const fetcher = jest.fn(async () => {
        if (shouldFail) throw new ApiErrorException('network', 'нет связи');
        return [];
      });

      queryClient.ensure(key, fetcher);
      await queryClient.refetch([key], { force: true });
      expect(queryClient.isConnectionOffline()).toBe(true);
      expect(queryClient.isConnectionOffline()).toBe(true);

      shouldFail = false;
      await queryClient.refetch([key], { force: true });
      expect(queryClient.isConnectionOffline()).toBe(false);
      expect(queryClient.getLastSuccessAt()).toBeGreaterThan(0);
    });

    it('HTTP-ошибка не считается потерей связи', async () => {
      const key = queryKeys.guilds();
      const fetcher = jest.fn(async () => {
        throw new ApiErrorException('http', 'Ошибка сервера (500)', 500);
      });

      queryClient.ensure(key, fetcher);
      await queryClient.refetch([key], { force: true });

      expect(queryClient.isConnectionOffline()).toBe(false);
      expect(queryClient.getEntry(key)?.error?.kind).toBe('http');
      expect(queryClient.getEntry(key)?.failures).toBe(1);
    });
  });
});
