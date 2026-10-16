/** Предприятия гильдии: GET /guilds/:id.json. Ключ ['guild', id, 'plants']. */
import ApiService from '../../services/api';
import { queryKeys } from '../keys';
import { queryClient } from '../queryClient';
import { useQuery, type QueryState } from '../useQuery';

/** TTL 15 с и опрос 30 с — предприятия меняют несколько мастеров одновременно. */
export const GUILD_PLANTS_TTL = 15_000;
export const GUILD_PLANTS_POLL = 30_000;

export const fetchGuildPlants = (guildId: number, signal?: AbortSignal): Promise<any[]> =>
  ApiService.getGuildPlants(guildId, signal);

export const useGuildPlants = (guildId: number | null | undefined): QueryState<any[]> =>
  useQuery<any[]>(
    queryKeys.guildPlants(guildId),
    (signal) => fetchGuildPlants(guildId as number, signal),
    {
      ttl: GUILD_PLANTS_TTL,
      pollInterval: GUILD_PLANTS_POLL,
      refetchOnMount: 'if-stale',
      enabled: guildId != null,
    },
  );

/** Императивная перезагрузка списка предприятий гильдии (кнопка/после мутации). */
export const refetchGuildPlants = (guildId: number): Promise<void> =>
  queryClient.refetch([queryKeys.guildPlants(guildId)], { force: true });
