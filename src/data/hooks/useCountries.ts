/** Страны (отношения, эмбарго): GET /countries/foreign_countries.json. Ключ ['countries']. */
import ApiService from '../../services/api';
import type { Country } from '../../types';
import { queryKeys } from '../keys';
import { useQuery, type QueryState } from '../useQuery';

/** TTL 10 с и опрос 30 с — как в era_front (Exchange.vue: setInterval 30000). */
export const COUNTRIES_TTL = 10_000;
export const COUNTRIES_POLL = 30_000;

export const fetchCountries = (signal: AbortSignal): Promise<Country[]> =>
  ApiService.getForeignCountries(signal);

export const useCountries = (): QueryState<Country[]> =>
  useQuery<Country[]>(queryKeys.countries(), fetchCountries, {
    ttl: COUNTRIES_TTL,
    pollInterval: COUNTRIES_POLL,
    refetchOnMount: 'if-stale',
  });

/**
 * Все страны игры: GET /countries.json. Ключ ['allCountries'].
 *
 * Отдельный ключ от ['countries']: там `foreign_countries` (чужие страны для
 * рынка), здесь — полный список государств, включая текущее. Нужен экрану
 * «Сражения»: город обороны выбирается в любой стране, а не только в Руси.
 */
export const ALL_COUNTRIES_TTL = 60_000;

export const fetchAllCountries = (signal: AbortSignal): Promise<Country[]> =>
  ApiService.getCountries(signal);

export const useAllCountries = (): QueryState<Country[]> =>
  useQuery<Country[]>(queryKeys.allCountries(), fetchAllCountries, {
    ttl: ALL_COUNTRIES_TTL,
    refetchOnMount: 'if-stale',
  });
