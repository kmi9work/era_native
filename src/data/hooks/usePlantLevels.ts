/**
 * Уровни предприятий (формулы, цены уровня): GET /plant_levels.json.
 *
 * Один ключ ['plantLevels'] на весь список; выборка по типу предприятия — фильтрация из кэша,
 * а не второй запрос того же эндпоинта (ТЗ § 8).
 */
import ApiService from '../../services/api';
import { queryKeys } from '../keys';
import { queryClient } from '../queryClient';
import { useQuery, type QueryState } from '../useQuery';

/** TTL 300 с и опрос 60 с: тяжёлый справочник, меняется при смене года/цикла. */
export const PLANT_LEVELS_TTL = 300_000;
export const PLANT_LEVELS_POLL = 60_000;

export const fetchAllPlantLevels = (signal: AbortSignal): Promise<any[]> =>
  ApiService.getAllPlantLevels(signal);

export const usePlantLevels = (): QueryState<any[]> =>
  useQuery<any[]>(queryKeys.plantLevels(), fetchAllPlantLevels, {
    ttl: PLANT_LEVELS_TTL,
    pollInterval: PLANT_LEVELS_POLL,
    refetchOnMount: 'if-stale',
  });

/** Уровни конкретного типа предприятия из общего списка. */
export const selectPlantLevelsForType = (levels: any[] | undefined, plantTypeId: number): any[] =>
  (levels || []).filter((level: any) => (level.plant_type?.id ?? level.plant_type_id) === plantTypeId);

/** Уровни типа предприятия из кэша слоя (без сетевого запроса). */
export const getCachedPlantLevelsForType = (plantTypeId: number): any[] =>
  selectPlantLevelsForType(queryClient.getQueryData<any[]>(queryKeys.plantLevels()), plantTypeId);

/** Гарантирует наличие справочника уровней в кэше и возвращает его. */
export const ensurePlantLevels = async (): Promise<any[]> => {
  if (queryClient.getQueryData<any[]>(queryKeys.plantLevels()) === undefined) {
    await queryClient.refetch([queryKeys.plantLevels()], { force: true });
  }
  return queryClient.getQueryData<any[]>(queryKeys.plantLevels()) ?? [];
};
