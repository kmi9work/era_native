/**
 * Технологии государства: GET /technologies.json. Ключ ['technologies'].
 *
 * Оттуда берётся название технологии и текст её эффекта — чтобы плашка «технология открыта»
 * показывала формулировку из игры, а не дублировала её в коде клиента.
 *
 * Второй ключ — технологии КОНКРЕТНОГО государства (['technologies', 'country', id]):
 * `is_open` сервер считает по государству запроса, а экрану улучшения нужно состояние
 * технологии в стране ЗЕМЕЛЬ предприятия, а не в текущем государстве.
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

/** Технологии заданного государства (не текущего). Без id — запроса нет. */
export const fetchCountryTechnologies = (
  countryId: number,
  signal: AbortSignal,
): Promise<any[]> => ApiService.getCountryTechnologies(countryId, signal);

/**
 * Опрос 60 с: экран улучшения держит статус «Сельских школ» на виду, а открыть
 * технологию может другой мастер (веб-админка) — иначе «Запрещено» висело бы
 * до ухода с экрана.
 */
export const COUNTRY_TECHNOLOGIES_POLL = 60_000;

export const useCountryTechnologies = (
  countryId: number | null | undefined,
): QueryState<any[]> =>
  useQuery<any[]>(
    queryKeys.technologiesForCountry(countryId),
    (signal) => fetchCountryTechnologies(countryId as number, signal),
    {
      ttl: TECHNOLOGIES_TTL,
      pollInterval: COUNTRY_TECHNOLOGIES_POLL,
      refetchOnMount: 'if-stale',
      enabled: countryId != null,
    },
  );

/** Технология по id из общего списка (выборка из кэша, без второго запроса). */
export const selectTechnology = (
  technologies: any[] | undefined,
  technologyId: number,
): any | undefined => (technologies || []).find((technology: any) => technology?.id === technologyId);
