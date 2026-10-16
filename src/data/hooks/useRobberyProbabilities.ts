/**
 * Вероятности ограбления по гильдиям: GET /caravans/check_robbery.json?guild_id=.
 *
 * Ключ на гильдию (['robbery', id]) — запросы идут параллельно, ошибка одной гильдии
 * не мешает остальным (эквивалент Promise.allSettled).
 */
import { useCallback, useEffect, useMemo } from 'react';
import ApiService from '../../services/api';
import { keyToString, queryKeys } from '../keys';
import { queryClient } from '../queryClient';
import { useKeysVersion } from '../useQuery';

export interface RobberyProbability {
  probability: number;
  robbed?: boolean;
}

/** TTL 30 с: пересчитывается бэкендом при изменении товарооборота. */
export const ROBBERY_TTL = 30_000;

const robberyFetcher = (guildId: number) => (signal: AbortSignal) => ApiService.checkRobbery(guildId, signal);

export const useRobberyProbabilities = (guildIds: number[]): {
  probabilities: Record<number, RobberyProbability>;
  isFetching: boolean;
  refetch: () => Promise<void>;
} => {
  const idsSignature = guildIds.join(',');
  const ids = useMemo(
    () =>
      Array.from(new Set(guildIds.filter((guildId) => Number.isFinite(guildId)))).sort((a, b) => a - b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsSignature],
  );

  // Регистрация fetcher'ов и TTL для каждого ключа (во время рендера — идемпотентно).
  for (const guildId of ids) {
    queryClient.ensure(queryKeys.robbery(guildId), robberyFetcher(guildId));
    queryClient.setOptions(queryKeys.robbery(guildId), { ttl: ROBBERY_TTL, refetchOnMount: 'if-stale' });
  }

  const keyStrings = useMemo(
    () => ids.map((guildId) => keyToString(queryKeys.robbery(guildId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsSignature],
  );

  const version = useKeysVersion(keyStrings);

  // Догрузка отсутствующих/устаревших ключей при появлении списка гильдий.
  useEffect(() => {
    if (ids.length === 0) return;
    void queryClient.refetch(ids.map((guildId) => queryKeys.robbery(guildId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSignature]);

  const probabilities = useMemo(() => {
    // version читается намеренно: записи кэша мутируются, и без этой зависимости
    // производные данные не пересчитаются после фонового обновления.
    void version;
    const result: Record<number, RobberyProbability> = {};
    for (const guildId of ids) {
      const entry = queryClient.getEntry(queryKeys.robbery(guildId));
      if (entry?.data) {
        const data = entry.data as { probability?: number; robbed?: boolean };
        result[guildId] = { probability: data.probability || 0, robbed: data.robbed || false };
      }
    }
    return result;
  }, [ids, version]);

  const isFetching = useMemo(() => {
    void version;
    return ids.some((guildId) => queryClient.getEntry(queryKeys.robbery(guildId))?.fetching === true);
  }, [ids, version]);

  // Стабильная ссылка: экранные хуки держат refetch в зависимостях useCallback.
  const refetch = useCallback(
    () => queryClient.refetch(ids.map((guildId) => queryKeys.robbery(guildId)), { force: true }),
    [ids],
  );

  return useMemo(() => ({ probabilities, isFetching, refetch }), [probabilities, isFetching, refetch]);
};
