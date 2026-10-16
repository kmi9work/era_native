/** Ресурсы (номенклатура): GET /resources/show_all_resources. Ключ ['resources']. */
import ApiService from '../../services/api';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/** TTL 300 с и опрос 60 с: справочник номенклатуры. */
export const RESOURCES_TTL = 300_000;
export const RESOURCES_POLL = 60_000;

export const fetchResources = (signal: AbortSignal): Promise<any[]> =>
  ApiService.getAllResources(signal);

export const useResources = (): QueryState<any[]> =>
  useQuery<any[]>(queryKeys.resources(), fetchResources, {
    ttl: RESOURCES_TTL,
    pollInterval: RESOURCES_POLL,
    refetchOnMount: 'if-stale',
  });
