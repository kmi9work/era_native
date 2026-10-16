/** Цены: GET /resources/show_prices.json. Ключ ['prices']. */
import ApiService from '../../services/api';
import { queryKeys } from '../keys';
import { queryClient } from '../queryClient';
import { useQuery, type QueryState } from '../useQuery';

export interface MarketPrices {
  off_market: any[];
  to_market: any[];
}

export interface PricesResponse {
  prices: MarketPrices;
}

/** TTL 10 с и опрос 60 с: цены — самые изменчивые данные рынка. */
export const PRICES_TTL = 10_000;
export const PRICES_POLL = 60_000;

export const fetchPrices = (signal: AbortSignal): Promise<PricesResponse> =>
  ApiService.getResourcesWithPrices(signal);

export const usePrices = (): QueryState<PricesResponse> =>
  useQuery<PricesResponse>(queryKeys.prices(), fetchPrices, {
    ttl: PRICES_TTL,
    pollInterval: PRICES_POLL,
    refetchOnMount: 'if-stale',
  });

/**
 * Принудительно свежие цены (Д7): используется перед регистрацией каравана и
 * перед расчётом, чтобы цифры на экране совпадали с серверными.
 */
export const refreshPricesNow = (): Promise<PricesResponse | undefined> =>
  queryClient
    .fetchQuery<PricesResponse>(queryKeys.prices(), fetchPrices, { force: true })
    .catch(() => queryClient.getQueryData<PricesResponse>(queryKeys.prices()));

export const getCachedPrices = (): PricesResponse | undefined =>
  queryClient.getQueryData<PricesResponse>(queryKeys.prices());
