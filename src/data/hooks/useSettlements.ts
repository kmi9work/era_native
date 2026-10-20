/** Поселения и регионы: GET /settlements.json?all=1 и GET /regions.json. */
import ApiService from '../../services/api';
import type { Region, Settlement } from '../../types';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/** Справочники меняются редко: TTL 60 с, без опроса (обновление при возврате на экран). */
export const SETTLEMENTS_TTL = 60_000;
export const REGIONS_TTL = 60_000;

export const fetchSettlements = (signal: AbortSignal): Promise<Settlement[]> =>
  ApiService.getSettlements(signal);

/** Свои регионы + чужие (`?foreign=1`), склеенные по id: см. ApiService.getRegions. */
export const fetchRegions = async (signal: AbortSignal): Promise<Region[]> => {
  const [own, foreign] = await Promise.all([
    ApiService.getRegions(signal, false),
    ApiService.getRegions(signal, true),
  ]);
  const byId = new Map<number, Region>();
  [...own, ...foreign].forEach(region => {
    if (!byId.has(region.id)) byId.set(region.id, region);
  });
  return [...byId.values()];
};

export const useSettlements = (): QueryState<Settlement[]> =>
  useQuery<Settlement[]>(queryKeys.settlements(), fetchSettlements, {
    ttl: SETTLEMENTS_TTL,
    refetchOnMount: 'if-stale',
  });

export const useRegions = (): QueryState<Region[]> =>
  useQuery<Region[]>(queryKeys.regions(), fetchRegions, {
    ttl: REGIONS_TTL,
    refetchOnMount: 'if-stale',
  });
