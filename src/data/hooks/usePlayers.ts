/** Все игроки игры: GET /players.json — назначение владельца города. Ключ ['players']. */
import ApiService from '../../services/api';
import type { Player } from '../../types';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/**
 * Список игроков меняется редко (создание/перевод игрока мастером), поэтому TTL 60 с
 * без опроса — как у остальных справочников экрана «Сражения».
 */
export const PLAYERS_TTL = 60_000;

export const fetchPlayers = (signal: AbortSignal): Promise<Player[]> => ApiService.getPlayers(signal);

export const usePlayers = (): QueryState<Player[]> =>
  useQuery<Player[]>(queryKeys.players(), fetchPlayers, {
    ttl: PLAYERS_TTL,
    refetchOnMount: 'if-stale',
  });
