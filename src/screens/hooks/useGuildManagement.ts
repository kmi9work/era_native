import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import ApiService from '../../services/api';
import { Guild } from '../../types';

/**
 * Хук для управления гильдиями.
 * Загружает список гильдий и управляет выбранной гильдией.
 */
export interface GuildManagementState {
  guilds: Guild[];
  selectedGuild: Guild | null;
  loading: boolean;
}

export function useGuildManagement() {
  const [state, setState] = useState<GuildManagementState>({
    guilds: [],
    selectedGuild: null,
    loading: false,
  });

  const loadGuilds = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await ApiService.getGuilds();
      const sortedData = data.sort((a, b) => a.id - b.id);
      setState((prev) => ({ ...prev, guilds: sortedData, loading: false }));
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const selectGuild = useCallback((guild: Guild) => {
    setState((prev) => ({ ...prev, selectedGuild: guild }));
  }, []);

  const clearSelectedGuild = useCallback(() => {
    setState((prev) => ({ ...prev, selectedGuild: null }));
  }, []);

  return {
    state,
    loadGuilds,
    selectGuild,
    clearSelectedGuild,
  };
}
