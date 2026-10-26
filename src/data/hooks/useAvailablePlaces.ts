/**
 * Доступные места: GET /plant_places/available_places?guild_id=.
 * Ключ — ['availablePlaces', guildId]: признак `allowed` считается по гильдии.
 */
import ApiService from '../../services/api';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/** TTL 60 с: места освобождаются при строительстве другими мастерами. */
export const AVAILABLE_PLACES_TTL = 60_000;

export const fetchAvailablePlaces =
  (guildId?: number | null) =>
  (signal: AbortSignal): Promise<any[]> =>
    ApiService.getAvailablePlaces(guildId, signal);

export const useAvailablePlaces = (guildId?: number | null): QueryState<any[]> =>
  useQuery<any[]>(queryKeys.availablePlaces(guildId), fetchAvailablePlaces(guildId), {
    ttl: AVAILABLE_PLACES_TTL,
    refetchOnMount: 'if-stale',
  });
