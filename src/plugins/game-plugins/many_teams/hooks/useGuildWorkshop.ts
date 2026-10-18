import { useQuery, type QueryState } from '../../../../data/useQuery';
import { fetchGuildWorkshop, type GuildWorkshopInfo } from '../services/guildWorkshop';

/**
 * Ключ слоя данных плагина. Собственная фабрика ключей: ключи ядра не
 * расширяются, чтобы не менять `src/data/keys.ts`.
 */
export const manyTeamsKeys = {
  workshop: (guildId: number | null | undefined) => ['many_teams', 'guild', guildId ?? 'none', 'workshop'] as const,
};

/** TTL 20 с, опрос 60 с: разрешения меняет Казначей, отметка должна обновляться. */
export const GUILD_WORKSHOP_TTL = 20_000;
export const GUILD_WORKSHOP_POLL = 60_000;

export const useGuildWorkshop = (guildId: number | null | undefined): QueryState<GuildWorkshopInfo> =>
  useQuery<GuildWorkshopInfo>(
    manyTeamsKeys.workshop(guildId),
    (signal) => fetchGuildWorkshop(guildId as number, signal),
    {
      ttl: GUILD_WORKSHOP_TTL,
      pollInterval: GUILD_WORKSHOP_POLL,
      refetchOnMount: 'if-stale',
      enabled: guildId != null,
    },
  );
