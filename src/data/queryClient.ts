/**
 * Ядро слоя данных (ТЗ § 5, решения Д2-Д4, Д8, Д9).
 *
 * Одна глобальная Map<keyString, Entry> вместо локального useState в каждом хуке:
 * - кэш только в памяти (без персиста, Д2);
 * - SWR: отдаём кэш сразу, обновляем в фоне (Д3);
 * - один таймер опроса на ключ, активен только пока есть подписчик в фокусе (Д4);
 * - отмена предыдущего запроса и правило «последний стартовавший побеждает» (Д9);
 * - нормализованные ошибки и признак «нет связи» (Д8).
 */
import { isAbortError, isOffline, normalizeError, type ApiError, type ApiErrorException } from './apiErrors';
import { keyToString, type QueryKey } from './keys';

export type RefetchMode = 'if-stale' | 'always' | 'never';

export interface QueryOptions {
  /** мс, после которого данные считаются устаревшими и подлежат фоновому обновлению */
  ttl: number;
  /** мс, интервал опроса — только пока хотя бы один подписчик в фокусе */
  pollInterval?: number;
  /** принудительное обновление при получении фокуса (Д5) */
  refetchOnFocus?: boolean;
  /** поведение при монтировании подписчика */
  refetchOnMount?: RefetchMode;
  /** выключенный ключ не грузит данные (например id ещё не известен) */
  enabled?: boolean;
}

export interface QueryEntry {
  key: QueryKey;
  keyString: string;
  data: unknown;
  error: ApiErrorException | undefined;
  updatedAt: number | undefined;
  /** помечен invalidate: данные считаются устаревшими независимо от updatedAt */
  invalidated: boolean;
  fetching: boolean;
  /** растёт при каждом изменении записи — снапшот для useSyncExternalStore */
  version: number;
  subscribers: number;
  focused: number;
  failures: number;
  options: QueryOptions;
  fetcher: (signal: AbortSignal) => Promise<unknown>;
  startedAt: number;
  fetchSeq: number;
  controller?: AbortController;
  promise?: Promise<void>;
  pollTimer?: ReturnType<typeof setTimeout>;
}

/** Не перезапускать запрос, стартовавший меньше этого времени назад (защита от дублей
 *  «монтирование + фокус» и быстрой навигации, критерий приёмки 9). */
const REFETCH_DEDUP_MS = 300;
/** Верхняя граница экспоненциального backoff при ошибках опроса (Д4). */
const MAX_BACKOFF_MS = 5 * 60 * 1000;
/** Джиттер интервала опроса — планшеты не бьют в сервер одновременно (Д4). */
const JITTER_RATIO = 0.1;

const defaultOptions: QueryOptions = { ttl: 0, refetchOnMount: 'if-stale', refetchOnFocus: true };

const NO_FETCHER = (): Promise<never> => Promise.reject(new Error('Для ключа не зарегистрирован fetcher'));

class QueryClient {
  private entries = new Map<string, QueryEntry>();
  private listeners = new Map<string, Set<() => void>>();
  private connectionListeners = new Set<() => void>();
  private lastSuccessAt: number | undefined;
  private offline = false;
  private connectionVersion = 0;

  // ---------------------------------------------------------------- записи кэша

  ensure(key: QueryKey, fetcher?: (signal: AbortSignal) => Promise<unknown>): QueryEntry {
    const keyString = keyToString(key);
    let entry = this.entries.get(keyString);
    if (!entry) {
      entry = {
        key,
        keyString,
        data: undefined,
        error: undefined,
        updatedAt: undefined,
        invalidated: false,
        fetching: false,
        version: 0,
        subscribers: 0,
        focused: 0,
        failures: 0,
        options: { ...defaultOptions },
        fetcher: fetcher ?? NO_FETCHER,
        startedAt: 0,
        fetchSeq: 0,
      };
      this.entries.set(keyString, entry);
    } else {
      entry.key = key;
      if (fetcher) entry.fetcher = fetcher;
    }
    return entry;
  }

  getEntry(key: QueryKey): QueryEntry | undefined {
    return this.entries.get(keyToString(key));
  }

  getEntryByString(keyString: string): QueryEntry | undefined {
    return this.entries.get(keyString);
  }

  getQueryData<T>(key: QueryKey): T | undefined {
    return this.entries.get(keyToString(key))?.data as T | undefined;
  }

  setQueryData<T>(key: QueryKey, data: T): void {
    const entry = this.ensure(key);
    entry.data = data;
    entry.error = undefined;
    entry.invalidated = false;
    entry.updatedAt = Date.now();
    entry.failures = 0;
    this.notifyEntry(entry);
  }

  remove(key: QueryKey): void {
    const keyString = keyToString(key);
    const entry = this.entries.get(keyString);
    if (!entry) return;
    if (entry.pollTimer) clearTimeout(entry.pollTimer);
    entry.controller?.abort();
    this.entries.delete(keyString);
    this.notify(keyString);
  }

  setOptions(key: QueryKey, options: Partial<QueryOptions>): void {
    const entry = this.ensure(key);
    const merged = { ...entry.options, ...options } as QueryOptions;
    const changed =
      merged.ttl !== entry.options.ttl ||
      merged.pollInterval !== entry.options.pollInterval ||
      merged.enabled !== entry.options.enabled;
    entry.options = merged;
    if (changed) this.schedulePolling(entry);
  }

  // ------------------------------------------------------------------ свежесть

  isStale(key: QueryKey): boolean {
    const entry = this.entries.get(keyToString(key));
    if (!entry || entry.updatedAt === undefined || entry.invalidated) return true;
    return Date.now() - entry.updatedAt > (entry.options.ttl ?? 0);
  }

  // ------------------------------------------------------------------ подписки

  subscribe(keyString: string, listener: () => void): () => void {
    let set = this.listeners.get(keyString);
    if (!set) {
      set = new Set();
      this.listeners.set(keyString, set);
    }
    set.add(listener);
    return () => {
      const current = this.listeners.get(keyString);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(keyString);
    };
  }

  subscribeMany(keyStrings: string[], listener: () => void): () => void {
    const unsubscribers = keyStrings.map((keyString) => this.subscribe(keyString, listener));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  getVersion(keyString: string): number {
    return this.entries.get(keyString)?.version ?? 0;
  }

  /** Суммарная версия набора ключей (примитив — годится для useSyncExternalStore). */
  getManyVersion(keyStrings: string[]): number {
    let total = 0;
    for (const keyString of keyStrings) total += this.getVersion(keyString);
    return total;
  }

  private notify(keyString: string): void {
    const set = this.listeners.get(keyString);
    if (!set) return;
    for (const listener of Array.from(set)) listener();
  }

  private notifyEntry(entry: QueryEntry): void {
    entry.version += 1;
    this.notify(entry.keyString);
  }

  // ------------------------------------------------------- подписчики и фокус

  addSubscriber(key: QueryKey): () => void {
    const entry = this.ensure(key);
    entry.subscribers += 1;
    return () => this.removeSubscriber(entry);
  }

  private removeSubscriber(entry: QueryEntry): void {
    entry.subscribers = Math.max(0, entry.subscribers - 1);
    if (entry.subscribers === 0) {
      // Уход последнего подписчика отменяет запрос и снимает таймер (Д9).
      entry.controller?.abort();
      entry.controller = undefined;
      this.clearPollTimer(entry);
    }
  }

  /** Подписчик в фокусе: включает/снимает опрос ключа (Д4). */
  setFocused(key: QueryKey, delta: number): void {
    const entry = this.ensure(key);
    entry.focused = Math.max(0, entry.focused + delta);
    if (entry.focused > 0) {
      this.schedulePolling(entry, { immediate: false });
    } else {
      this.clearPollTimer(entry);
    }
  }

  private clearPollTimer(entry: QueryEntry): void {
    if (entry.pollTimer) {
      clearTimeout(entry.pollTimer);
      entry.pollTimer = undefined;
    }
  }

  private schedulePolling(entry: QueryEntry, opts: { immediate?: boolean } = {}): void {
    this.clearPollTimer(entry);
    const interval = entry.options.pollInterval;
    if (!interval || interval <= 0) return;
    // Опрос живёт только при подписчике в фокусе; опрос в фоне не ведём (Д4).
    if (entry.focused <= 0 || entry.subscribers <= 0) return;

    const base = entry.failures > 0 ? Math.min(interval * 2 ** entry.failures, MAX_BACKOFF_MS) : interval;
    const delay = Math.max(1, Math.round(base * (1 + (Math.random() * 2 - 1) * JITTER_RATIO)));
    entry.pollTimer = setTimeout(() => {
      entry.pollTimer = undefined;
      if (entry.focused <= 0) return;
      void this.startFetch(entry, { force: true });
    }, opts.immediate ? 0 : delay);
  }

  // ------------------------------------------------------------------- загрузка

  private notifyGlobal(): void {
    this.connectionVersion += 1;
    for (const listener of Array.from(this.connectionListeners)) listener();
  }

  private startFetch(entry: QueryEntry, opts: { force?: boolean } = {}): Promise<void> {
    // Единая точка загрузки: ключ без зарегистрированного fetcher — это ошибка компоновки экрана,
    // а не сетевой сбой. Раньше такая попытка клала в запись ошибку kind 'network' и мастер видел
    // шильдик «нет связи» на работающем соединении (проверка свежести читает ошибку записи).
    if (entry.fetcher === NO_FETCHER) {
      if (__DEV__) {
        console.warn(
          `Слой данных: у ключа ${entry.keyString} нет зарегистрированного fetcher — запрос пропущен`,
        );
      }
      return Promise.resolve();
    }

    const now = Date.now();
    if (entry.fetching && entry.controller) {
      // Дедупликация: пока запрос в полёте, второй не стартует.
      // force перезапускает его только если предыдущий стартовал больше REFETCH_DEDUP_MS назад.
      const tooFresh = now - entry.startedAt < REFETCH_DEDUP_MS;
      if ((!opts.force || tooFresh) && entry.promise) return entry.promise;
    }

    entry.controller?.abort();
    const controller = new AbortController();
    entry.controller = controller;
    const seq = ++entry.fetchSeq;
    entry.startedAt = now;
    entry.fetching = true;
    this.notifyEntry(entry);

    const promise = (async () => {
      try {
        const data = await entry.fetcher(controller.signal);
        // «Последний стартовавший побеждает»: ответ устаревшего запроса отбрасываем (Д9).
        if (seq !== entry.fetchSeq) return;
        entry.data = data;
        entry.updatedAt = Date.now();
        entry.error = undefined;
        entry.invalidated = false;
        entry.failures = 0;
        this.lastSuccessAt = entry.updatedAt;
        const wasOffline = this.offline;
        this.offline = false;
        if (wasOffline) this.notifyGlobal();
      } catch (error) {
        if (isAbortError(error)) return;
        if (seq !== entry.fetchSeq) return;
        const normalized = normalizeError(error);
        if (isAbortError(normalized.payload)) return;
        entry.error = normalized;
        entry.failures += 1;
        if (isOffline(normalized) && !this.offline) {
          this.offline = true;
          this.notifyGlobal();
        }
      } finally {
        if (seq === entry.fetchSeq) {
          entry.fetching = false;
          entry.controller = undefined;
          entry.promise = undefined;
          this.notifyEntry(entry);
          this.schedulePolling(entry);
        }
      }
    })();
    entry.promise = promise;
    return promise;
  }

  /** Принудительное/фоновое обновление ключей. Никогда не отклоняется. */
  refetch(keys: QueryKey[], opts: { force?: boolean } = {}): Promise<void> {
    const tasks = keys.map((key) => {
      const entry = this.getEntry(key);
      // Ключ, на который никто не подписан (fetcher не зарегистрирован), не грузим и НЕ создаём
      // запись: раньше такая попытка оставляла в записи ошибку kind 'network', и экран показывал
      // «нет связи» на здоровом соединении. Это ошибка компоновки экрана — в dev говорим о ней
      // прямо, вместо того чтобы выдавать её за сетевой сбой.
      if (!entry || entry.fetcher === NO_FETCHER) {
        if (__DEV__) {
          console.warn(
            `Слой данных: обновление ключа ${keyToString(key)} пропущено — fetcher не зарегистрирован ` +
              '(экран должен читать данные хуком слоя, а не вызывать refetch на «свободный» ключ)',
          );
        }
        return Promise.resolve();
      }
      // Выключенный ключ (enabled: false) не грузим — так же ведёт себя и сам useQuery.
      if (entry.options.enabled === false) return Promise.resolve();
      if (!opts.force && !this.isStale(key)) return Promise.resolve();
      return this.startFetch(entry, opts.force ? { force: true } : {});
    });
    return Promise.all(tasks).then(() => undefined);
  }

  /** Императивная загрузка через слой: регистрирует fetcher и возвращает данные либо бросает ApiError. */
  async fetchQuery<T>(key: QueryKey, fetcher: (signal: AbortSignal) => Promise<T>, opts: { force?: boolean } = {}): Promise<T> {
    const entry = this.ensure(key, fetcher as (signal: AbortSignal) => Promise<unknown>);
    await this.startFetch(entry, { force: opts.force !== false });
    if (entry.error) throw entry.error;
    return entry.data as T;
  }

  /** Пометка ключей устаревшими после своей мутации (Д-doc, § 5 правило 4). */
  invalidate(keys: QueryKey[]): void {
    for (const key of keys) {
      const entry = this.entries.get(keyToString(key));
      if (!entry) continue;
      entry.invalidated = true;
      this.notifyEntry(entry);
      if (entry.subscribers > 0) void this.startFetch(entry, { force: true });
    }
  }

  /** Инвалидация по префиксу: invalidatePrefix(['guild']) → guild:12:plants, guild:7:plants… */
  invalidatePrefix(prefix: QueryKey): void {
    const prefixString = keyToString(prefix);
    for (const entry of Array.from(this.entries.values())) {
      if (entry.keyString !== prefixString && !entry.keyString.startsWith(`${prefixString}:`)) continue;
      this.invalidate([entry.key]);
    }
  }

  // -------------------------------------------------------- состояние связи

  getLastSuccessAt(): number | undefined {
    return this.lastSuccessAt;
  }

  isConnectionOffline(): boolean {
    return this.offline;
  }

  subscribeConnection(listener: () => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  getConnectionVersion(): number {
    return this.connectionVersion;
  }

  /** Только для тестов: полностью очищает хранилище. */
  reset(): void {
    for (const entry of Array.from(this.entries.values())) {
      if (entry.pollTimer) clearTimeout(entry.pollTimer);
      entry.controller?.abort();
    }
    this.entries.clear();
    this.listeners.clear();
    this.connectionListeners.clear();
    this.lastSuccessAt = undefined;
    this.offline = false;
    this.connectionVersion = 0;
  }

  /** Диагностика: сколько ключей в кэше и сколько запросов в полёте. */
  stats(): { keys: number; fetching: number } {
    let fetching = 0;
    for (const entry of this.entries.values()) if (entry.fetching) fetching += 1;
    return { keys: this.entries.size, fetching };
  }
}

export const queryClient = new QueryClient();
export type { ApiError };
export { REFETCH_DEDUP_MS, MAX_BACKOFF_MS, JITTER_RATIO };
