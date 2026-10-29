import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useResources } from '../../data/hooks/useResources';
import ApiService from '../../services/api';
import { CONFIG } from '../../config';
import { feedToPlant, techSchoolsOpenForPlant } from '../../services/plantProduction';

const getBaseUrl = () => {
  const configuredBase = (CONFIG.BACKEND_URL || '').replace(/\/+$/, '').replace(/\/backend$/i, '');
  return configuredBase || ApiService.getBaseUrl() || 'http://192.168.1.38:3000';
};

const addResourceMeta = (resources: any[], resourcesList: any[]): any[] => {
  const baseUrl = getBaseUrl();
  return resources.map((res: any) => {
    const resourceInfo = resourcesList.find((r: any) => r.identificator === res.identificator);
    return {
      ...res,
      name: res.name || resourceInfo?.name || res.identificator || '',
      imageUrl: res.imageUrl || `${baseUrl}/images/resources/${res.identificator}.png`,
    };
  });
};

// Helper functions for resource calculations
// Расчёт переработки (включая эффект «Технических училищ») — в src/services/plantProduction.ts,
// здесь только навешивание названий и картинок ресурсов.

export interface MultiEnterpriseEntry {
  plantId: number;
  plant: any;
  guild: any;
  isExtractive: boolean;
  formulaFrom: any[];
  formulaTo: any[];
  inputFrom: Record<string, string>;
  resultFrom: any[];
  resultTo: any[];
  resultChange: any[];
  fullPlantLevel: any;
}

export interface MultiTotals {
  resultFrom: any[];
  resultTo: any[];
  resultChange: any[];
}

export interface MultiEnterpriseContextType {
  entries: MultiEnterpriseEntry[];
  totals: MultiTotals;
  isLoading: boolean;
  resources: any[];
  /** Открыта ли технология «Технические училища» для предприятий списка. */
  techSchoolsOpen: boolean;
  addEntry: (entry: MultiEnterpriseEntry) => void;
  removeEntry: (plantId: number) => void;
  clearEntries: () => void;
  setEntryInputFromValue: (plantId: number, identificator: string, value: string) => void;
  calculateFrom: () => void;
  setLoading: (loading: boolean) => void;
}

const MultiEnterpriseContext = createContext<MultiEnterpriseContextType | undefined>(undefined);

export const MultiEnterpriseProvider = MultiEnterpriseContext.Provider;

export const useMultiEnterprise = () => {
  const context = useContext(MultiEnterpriseContext);
  if (!context) {
    throw new Error('useMultiEnterprise must be used within MultiEnterpriseProvider');
  }
  return context;
};

// Custom hook with all logic
export const useMultiEnterpriseLogic = () => {
  const [entries, setEntries] = useState<MultiEnterpriseEntry[]>([]);
  const [totals, setTotals] = useState<MultiTotals>({ resultFrom: [], resultTo: [], resultChange: [] });
  const [isLoading, setIsLoading] = useState(false);

  // Справочник ресурсов берётся из слоя: ключ ['resources'], TTL 300 с, опрос 60 с в фокусе.
  const resourcesQuery = useResources();
  const resources = useMemo(() => (resourcesQuery.data as any[]) ?? [], [resourcesQuery.data]);

  const addEntry = useCallback((entry: MultiEnterpriseEntry) => {
    setEntries((prev) => {
      if (prev.some((e) => e.plantId === entry.plantId)) {
        return prev;
      }
      return [...prev, entry];
    });
  }, []);

  const removeEntry = useCallback((plantId: number) => {
    setEntries((prev) => prev.filter((e) => e.plantId !== plantId));
    setTotals({ resultFrom: [], resultTo: [], resultChange: [] });
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    setTotals({ resultFrom: [], resultTo: [], resultChange: [] });
  }, []);

  const setEntryInputFromValue = useCallback((plantId: number, identificator: string, value: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.plantId === plantId
          ? { ...entry, inputFrom: { ...entry.inputFrom, [identificator]: value } }
          : entry
      )
    );
    setTotals({ resultFrom: [], resultTo: [], resultChange: [] });
  }, []);

  const calculateFrom = useCallback(() => {
    if (entries.length === 0) {
      return;
    }

    const updatedEntries: MultiEnterpriseEntry[] = [];
    let aggregatedResultTo: any[] = [];
    let aggregatedResultChange: any[] = [];

    for (const entry of entries) {
      // For extractive plants, just use formulaTo
      if (entry.isExtractive) {
        const resultTo = addResourceMeta((entry.formulaTo || []).map((resource: any) => ({
          ...resource,
          count: resource.count || 0,
        })), resources);

        aggregatedResultTo = aggregatedResultTo.concat(resultTo);
        updatedEntries.push({ ...entry, resultFrom: [], resultTo, resultChange: [] });
        continue;
      }

      // For processing plants, calculate based on input
      const formulas = entry.plant?.plant_level?.formulas || [];

      const requestArray = Object.entries(entry.inputFrom || {})
        .map(([identificator, value]) => ({
          identificator,
          count: parseInt((value as string) || '0', 10),
        }))
        .filter((item) => item.count > 0);

      if (formulas.length === 0 || requestArray.length === 0) {
        updatedEntries.push({ ...entry, resultFrom: [], resultTo: [], resultChange: [] });
        continue;
      }

      // Единый расчёт: последовательный расход сырья по формулам + эффект «Технических училищ»
      // (признак — по землям этого предприятия; у добывающих его нет).
      const { from, to, change } = feedToPlant(formulas, requestArray, 'from', {
        techSchoolsOpen: !entry.isExtractive && techSchoolsOpenForPlant(entry.plant, entry.fullPlantLevel),
      });

      const resultTo = addResourceMeta(to, resources);
      const resultChange = addResourceMeta(change, resources);

      aggregatedResultTo = aggregatedResultTo.concat(resultTo);
      aggregatedResultChange = aggregatedResultChange.concat(resultChange);

      updatedEntries.push({
        ...entry,
        resultFrom: addResourceMeta(from, resources),
        resultTo,
        resultChange,
      });
    }

    // Результаты кладутся и в строки, и в итоги: раньше результат по предприятию не доезжал
    // до строки (возврат forEach отбрасывался), и таблица показывала базовую формулу уровня.
    setEntries(updatedEntries);
    setTotals({
      resultFrom: [],
      resultTo: addResourceMeta(aggregatedResultTo, resources),
      resultChange: addResourceMeta(aggregatedResultChange, resources),
    });
  }, [entries, resources]);

  /** Технология «Технические училища» открыта хотя бы для одного перерабатывающего предприятия списка. */
  const techSchoolsOpen = useMemo(
    () =>
      entries.some(
        (entry) =>
          !entry.isExtractive && techSchoolsOpenForPlant(entry.plant, entry.fullPlantLevel),
      ),
    [entries],
  );

  return {
    entries,
    totals,
    isLoading,
    resources,
    techSchoolsOpen,
    addEntry,
    removeEntry,
    clearEntries,
    setEntryInputFromValue,
    calculateFrom,
    setLoading: setIsLoading,
  };
};
