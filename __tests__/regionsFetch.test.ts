/**
 * Склейка регионов для выбора города: бэкенд отдаёт свои земли без параметра,
 * а чужие — с `?foreign=1`. Без второго запроса в выборе места остаётся одна Русь.
 */
jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { getRegions: jest.fn() },
}));

import ApiService from '../src/services/api';
import { fetchRegions } from '../src/data/hooks/useSettlements';

const region = (id: number, name: string, countryId: number, countryName: string) => ({
  id,
  name,
  country_id: countryId,
  country: { id: countryId, name: countryName },
});

describe('fetchRegions', () => {
  it('запрашивает свои и чужие регионы и склеивает их без дублей', async () => {
    (ApiService.getRegions as jest.Mock).mockImplementation(
      async (_signal: AbortSignal, foreign: boolean) =>
        foreign
          ? [region(5, 'Казанская земля', 6, 'Казанское ханство'), region(1, 'Дубль', 1, 'Русь')]
          : [region(1, 'Московская земля', 1, 'Русь')],
    );

    const regions = await fetchRegions(new AbortController().signal);

    expect(ApiService.getRegions).toHaveBeenCalledWith(expect.anything(), false);
    expect(ApiService.getRegions).toHaveBeenCalledWith(expect.anything(), true);
    expect(regions.map(item => item.id).sort()).toEqual([1, 5]);
    // При совпадении id остаётся «свой» регион.
    expect(regions.find(item => item.id === 1)?.name).toBe('Московская земля');
  });
});
