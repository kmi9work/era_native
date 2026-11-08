/** Типы отрядов с ценой найма: GET /troop_types.json. Ключ ['troopTypes']. */
import ApiService from '../../services/api';
import type { TroopType } from '../../types';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/** Справочник меняется только с сидами: TTL 300 с, без опроса. */
export const TROOP_TYPES_TTL = 300_000;

export const fetchTroopTypes = (signal: AbortSignal): Promise<TroopType[]> =>
  ApiService.getTroopTypes(signal);

export const useTroopTypes = (): QueryState<TroopType[]> =>
  useQuery<TroopType[]>(queryKeys.troopTypes(), fetchTroopTypes, {
    ttl: TROOP_TYPES_TTL,
    refetchOnMount: 'if-stale',
  });
