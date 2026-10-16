/**
 * Технологии государства: GET /technologies.json. Ключ ['technologies'].
 *
 * Оттуда берётся название технологии и текст её эффекта — чтобы плашка «технология открыта»
 * показывала формулировку из игры, а не дублировала её в коде клиента.
 */
import ApiService from '../../services/api';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/** TTL 60 с без опроса: открытие технологии подхватывается при возврате на экран. */
export const TECHNOLOGIES_TTL = 60_000;

export const fetchTechnologies = (signal: AbortSignal): Promise<any[]> =>
  ApiService.getTechnologies(signal);

export const useTechnologies = (): QueryState<any[]> =>
  useQuery<any[]>(queryKeys.technologies(), fetchTechnologies, {
    ttl: TECHNOLOGIES_TTL,
    refetchOnMount: 'if-stale',
  });

/** Технология по id из общего списка (выборка из кэша, без второго запроса). */
export const selectTechnology = (
  technologies: any[] | undefined,
  technologyId: number,
): any | undefined => (technologies || []).find((technology: any) => technology?.id === technologyId);
