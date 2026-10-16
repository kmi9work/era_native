/**
 * Публичный вход в слой данных клиента (ТЗ «Единый слой загрузки данных»).
 * Экраны импортируют прикладные хуки отсюда, а не из services/api.
 */
export { queryKeys, keyToString, type QueryKey } from './keys';
export { queryClient, type QueryOptions, type QueryEntry } from './queryClient';
export { useQuery, useKeysVersion, useConnectionState, useNow, type QueryState } from './useQuery';
export { useRefetchOnFocus } from './useRefetchOnFocus';
export { useMutation, type MutationOptions } from './useMutation';
export {
  ApiErrorException,
  isApiError,
  isAbortError,
  isOffline,
  normalizeError,
  getErrorMessage,
  type ApiError,
  type ApiErrorKind,
} from './apiErrors';

export { useGuilds, fetchGuilds, GUILDS_TTL } from './hooks/useGuilds';
export {
  useGuildPlants,
  fetchGuildPlants,
  refetchGuildPlants,
  GUILD_PLANTS_TTL,
  GUILD_PLANTS_POLL,
} from './hooks/useGuildPlants';
export { usePlant, fetchPlant, loadPlant, getCachedPlant, PLANT_TTL } from './hooks/usePlant';
export {
  usePlantLevels,
  selectPlantLevelsForType,
  getCachedPlantLevelsForType,
  ensurePlantLevels,
  PLANT_LEVELS_TTL,
  PLANT_LEVELS_POLL,
} from './hooks/usePlantLevels';
export { useResources, fetchResources, RESOURCES_TTL, RESOURCES_POLL } from './hooks/useResources';
export {
  useAvailablePlaces,
  fetchAvailablePlaces,
  AVAILABLE_PLACES_TTL,
} from './hooks/useAvailablePlaces';
export { useCountries, fetchCountries, COUNTRIES_TTL, COUNTRIES_POLL } from './hooks/useCountries';
export {
  usePrices,
  fetchPrices,
  refreshPricesNow,
  getCachedPrices,
  PRICES_TTL,
  PRICES_POLL,
  type MarketPrices,
  type PricesResponse,
} from './hooks/usePrices';
export {
  useRobberyProbabilities,
  ROBBERY_TTL,
  type RobberyProbability,
} from './hooks/useRobberyProbabilities';
