/** Доступные места: GET /plant_places/available_places. Ключ ['availablePlaces']. */
import ApiService from '../../services/api';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/** TTL 60 с: места освобождаются при строительстве другими мастерами. */
export const AVAILABLE_PLACES_TTL = 60_000;

export const fetchAvailablePlaces = (signal: AbortSignal): Promise<any[]> =>
  ApiService.getAvailablePlaces(signal);

export const useAvailablePlaces = (): QueryState<any[]> =>
  useQuery<any[]>(queryKeys.availablePlaces(), fetchAvailablePlaces, {
    ttl: AVAILABLE_PLACES_TTL,
    refetchOnMount: 'if-stale',
  });
