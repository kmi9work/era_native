import { useCallback, useMemo, useState } from 'react';
import { useGuilds } from '../../data/hooks/useGuilds';
import { queryKeys } from '../../data/keys';
import { queryClient } from '../../data/queryClient';
import { Guild } from '../../types';

/**
 * Хук для управления гильдиями.
 * Данные берутся из слоя (ключ ['guilds']): TTL 60 с, обновление в фоне, refetch-on-focus
 * выполняет экран. Наружу — те же поля и функции, что были до перехода на слой.
 */
export interface GuildManagementState {
  guilds: Guild[];
  selectedGuild: Guild | null;
  loading: boolean;
  /** идёт любое обновление (в том числе фоновое) */
  refreshing: boolean;
  /** нет связи — показаны последние полученные данные */
  isOffline: boolean;
  /** данные устарели по TTL/инвалидации */
  isStale: boolean;
  updatedAt: number | undefined;
  error: unknown;
}

export function useGuildManagement() {
  const query = useGuilds();
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);

  const guilds = useMemo(
    () => [...((query.data as Guild[]) ?? [])].sort((a, b) => a.id - b.id),
    [query.data],
  );

  /** Ручное обновление (pull-to-refresh, кнопка). Ошибки не алертятся: признак «нет связи» в бейдже. */
  const loadGuilds = useCallback(
    () => queryClient.refetch([queryKeys.guilds()], { force: true }),
    [],
  );

  const selectGuild = useCallback((guild: Guild) => {
    setSelectedGuild(guild);
  }, []);

  const clearSelectedGuild = useCallback(() => {
    setSelectedGuild(null);
  }, []);

  return {
    state: {
      guilds,
      selectedGuild,
      loading: query.isLoading,
      refreshing: query.isFetching,
      isOffline: query.isOffline,
      isStale: query.isStale,
      updatedAt: query.updatedAt,
      error: query.error,
    },
    loadGuilds,
    selectGuild,
    clearSelectedGuild,
  };
}
