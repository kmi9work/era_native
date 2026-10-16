/** Гильдии: GET /guilds.json. Один ключ ['guilds'] для цеха и рынка (см. keys.ts). */
import ApiService from '../../services/api';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/** TTL 60 с: список гильдий меняется редко. */
export const GUILDS_TTL = 60_000;

export const fetchGuilds = (signal: AbortSignal): Promise<any[]> => ApiService.getGuilds(signal);

export const useGuilds = (): QueryState<any[]> =>
  useQuery<any[]>(queryKeys.guilds(), fetchGuilds, { ttl: GUILDS_TTL, refetchOnMount: 'if-stale' });
