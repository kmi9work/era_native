/** Армии игры: GET /armies.json. Ключ ['armies']. Экран «Сражения». */
import ApiService from '../../services/api';
import type { Army } from '../../types';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/**
 * TTL 15 с и опрос 30 с: состав армий меняется в течение игры (найм, потери,
 * перемещение), а экран держат открытым на столе. Пока идёт бой, состав
 * фиксируется в состоянии экрана и фоновое обновление его не перерисовывает.
 */
export const ARMIES_TTL = 15_000;
export const ARMIES_POLL = 30_000;

export const fetchArmies = (signal: AbortSignal): Promise<Army[]> => ApiService.getArmies(signal);

export const useArmies = (): QueryState<Army[]> =>
  useQuery<Army[]>(queryKeys.armies(), fetchArmies, {
    ttl: ARMIES_TTL,
    pollInterval: ARMIES_POLL,
    refetchOnMount: 'if-stale',
  });
