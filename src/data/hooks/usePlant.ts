/** Предприятие по id: GET /plants/:id.json. TTL 0 — данные всегда свежие. */
import ApiService from '../../services/api';
import { queryKeys } from '../keys';
import { queryClient } from '../queryClient';
import { useQuery, type QueryState } from '../useQuery';

export const PLANT_TTL = 0;

export const fetchPlant = (plantId: number, signal?: AbortSignal): Promise<any> =>
  ApiService.getPlant(plantId, signal);

/** Подписка на предприятие (например на экране улучшения). */
export const usePlant = (plantId: number | null | undefined): QueryState<any> =>
  useQuery<any>(queryKeys.plant(plantId), (signal) => fetchPlant(plantId as number, signal), {
    ttl: PLANT_TTL,
    refetchOnMount: 'if-stale',
    enabled: plantId != null,
  });

/**
 * Императивная свежая загрузка предприятия через слой (скан штрихкода, форма улучшения).
 * Отменяет предыдущий запрос по этому же ключу (Д9) и кладёт результат в кэш.
 */
export const loadPlant = (plantId: number): Promise<any> =>
  queryClient.fetchQuery<any>(queryKeys.plant(plantId), (signal) => fetchPlant(plantId, signal), { force: true });

export const getCachedPlant = (plantId: number): any =>
  queryClient.getQueryData<any>(queryKeys.plant(plantId));
