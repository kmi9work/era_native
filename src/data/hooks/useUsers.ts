/**
 * Пользователи игры (мастера): GET /users.json. Ключ ['users'].
 *
 * Список меняется только при заведении нового мастера, поэтому TTL 5 минут и
 * без опроса.
 */
import ApiService from '../../services/api';
import type { AppUser } from '../../types';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

export const USERS_TTL = 300_000;

export const fetchUsers = (signal: AbortSignal): Promise<AppUser[]> => ApiService.getUsers(signal);

export const useUsers = (): QueryState<AppUser[]> =>
  useQuery<AppUser[]>(queryKeys.users(), fetchUsers, {
    ttl: USERS_TTL,
    refetchOnMount: 'if-stale',
  });
