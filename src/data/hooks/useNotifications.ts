/**
 * Неподтверждённые уведомления мастера: GET /notifications.json?user_id=&status=pending.
 * Ключ ['notifications', userId].
 *
 * TTL 5 с и опрос 10 с: уведомление должно всплыть в течение десяти секунд после
 * действия (открытие технологии), а не при возврате на экран. Опрос включает
 * только подписчик «в фокусе», поэтому полноэкранное окно на корне приложения
 * держит фокус своего ключа само (см. components/NotificationOverlay.tsx).
 */
import ApiService from '../../services/api';
import type { AppNotification } from '../../types';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

export const NOTIFICATIONS_TTL = 5_000;
export const NOTIFICATIONS_POLL = 10_000;

export const fetchNotifications = (
  userId: number,
  signal: AbortSignal,
): Promise<AppNotification[]> => ApiService.getNotifications(userId, signal);

export const useNotifications = (userId: number | null): QueryState<AppNotification[]> =>
  useQuery<AppNotification[]>(
    queryKeys.notifications(userId),
    (signal) => fetchNotifications(userId as number, signal),
    {
      ttl: NOTIFICATIONS_TTL,
      pollInterval: NOTIFICATIONS_POLL,
      // Без выбранного мастера запрос не нужен: уведомления адресованы человеку.
      enabled: userId != null,
      refetchOnMount: 'always',
    },
  );
