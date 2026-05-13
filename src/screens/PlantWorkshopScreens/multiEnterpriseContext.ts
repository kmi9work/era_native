import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import ApiService from '../../services/api';
import { CONFIG } from '../../config';

const getBaseUrl = () => {
  const configuredBase = (CONFIG.BACKEND_URL || '').replace(/\/+$/, '').replace(/\/backend$/i, '');
  return configuredBase || (ApiService['api']?.defaults?.baseURL || 'http://192.168.1.38:3000');
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
const deriveFormulaFrom = (formulas: any[]): any[] => {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const f of (formulas || [])) {
    for (const item of (f.from || [])) {
      if (!seen.has(item.identificator)) {
        seen.add(item.identificator);
        result.push(item);
      }
    }
  }
  return result;
};

const deriveFormulaTo = (formulas: any[]): any[] => {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const f of (formulas || [])) {
    for (const item of (f.to || [])) {
      if (!seen.has(item.identificator)) {
        seen.add(item.identificator);
        result.push(item);
      }
    }
  }
  return result;
};

const resArrayMult = (resArray: any[], n: number): any[] => {
  return resArray.map((res) => ({ ...res, count: res.count * n }));
};

const resArraySum = (array1: any[], array2: any[], sign: number = 1): any[] => {
  const arr2Copy = JSON.parse(JSON.stringify(array2));
  for (const res1 of array1) {
    for (let i = arr2Copy.length - 1; i >= 0; i--) {
      if (res1.identificator === arr2Copy[i].identificator) {
        res1.count += arr2Copy[i].count * sign;
        arr2Copy.splice(i, 1);
      }
    }
  }
  for (const res of arr2Copy) {
    array1.push({ ...res, count: res.count * sign });
  }
  return array1;
};

const isResArrayLess = (resArray1: any[], resArray2: any[]): boolean => {
  for (const res1 of resArray1) {
    const var2 = resArray2.find((res2: any) => res1.identificator === res2.identificator);
    if (!var2) return false;
    if (res1.count > var2.count) return false;
  }
  return true;
};

const countRequest = (
  formula: any,
  request: any[],
  way: string,
  resArrayMultFn: typeof resArrayMult,
  resArraySumFn: typeof resArraySum,
  isResArrayLessFn: typeof isResArrayLess,
): { from: any[]; to: any[] } => {
  let n = 0;
  let bucket = JSON.parse(JSON.stringify(formula[way]));
  const formulaPart = formula[way];

  while (
    isResArrayLessFn(bucket, request) &&
    isResArrayLessFn(resArrayMultFn(formula.to, n + 1), formula.max_product)
  ) {
    bucket = resArraySumFn(bucket, JSON.parse(JSON.stringify(formulaPart)));
    n += 1;
  }

  return { from: resArrayMultFn(formula.from, n), to: resArrayMultFn(formula.to, n) };
};

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
  const [resources, setResources] = useState<any[]>([]);

  // Load resources on mount
  useEffect(() => {
    const loadResources = async () => {
      try {
        const data = await ApiService.getAllResources();
        setResources(data);
      } catch (error) {
        // ignore
      }
    };
    loadResources();
  }, []);

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

    let aggregatedResultTo: any[] = [];
    let aggregatedResultFrom: any[] = [];
    let aggregatedResultChange: any[] = [];

    const updatedEntries = entries.map((entry) => {
      // For extractive plants, just use formulaTo
      if (entry.isExtractive) {
        const resultTo = addResourceMeta((entry.formulaTo || []).map((resource: any) => ({
          ...resource,
          count: resource.count || 0,
        })), resources);

        aggregatedResultTo = aggregatedResultTo.concat(resultTo);

        return {
          ...entry,
          resultFrom: [],
          resultTo,
          resultChange: [],
        };
      }

      // For processing plants, calculate based on input
      const formulas = entry.plant?.plant_level?.formulas || [];
      if (formulas.length === 0) {
        return { ...entry, resultFrom: [], resultTo: [], resultChange: [] };
      }

      const requestArray = Object.entries(entry.inputFrom || {})
        .map(([identificator, value]) => ({
          identificator,
          count: parseInt((value as string) || '0', 10),
        }))
        .filter((item) => item.count > 0);

      if (requestArray.length === 0) {
        return { ...entry, resultFrom: [], resultTo: [], resultChange: [] };
      }

      const requestCopy = JSON.parse(JSON.stringify(requestArray));
      let resultingFrom: any[] = [];
      let resultingTo: any[] = [];

      formulas.forEach((formula: any) => {
        const { from, to } = countRequest(
          formula,
          requestCopy,
          'from',
          resArrayMult,
          resArraySum,
          isResArrayLess
        );
        if (from.length > 0) {
          resArraySum(resultingFrom, from);
          resArraySum(requestCopy, from, -1);
        }
        if (to.length > 0) {
          resArraySum(resultingTo, to);
        }
      });

      // Add meta to results
      const resultingToWithMeta = addResourceMeta(resultingTo, resources);
      const requestCopyWithMeta = addResourceMeta(requestCopy.filter((item: any) => item.count > 0), resources);

      aggregatedResultTo = aggregatedResultTo.concat(resultingToWithMeta);
      aggregatedResultChange = aggregatedResultChange.concat(requestCopyWithMeta);

      return {
        ...entry,
        resultFrom: [],
        resultTo: resultingToWithMeta,
        resultChange: requestCopyWithMeta,
      };
    });

    // Add meta to aggregated totals
    setTotals({
      resultFrom: addResourceMeta(aggregatedResultFrom, resources),
      resultTo: addResourceMeta(aggregatedResultTo, resources),
      resultChange: addResourceMeta(aggregatedResultChange, resources),
    });
  }, [entries, resources]);

  return {
    entries,
    totals,
    isLoading,
    resources,
    addEntry,
    removeEntry,
    clearEntries,
    setEntryInputFromValue,
    calculateFrom,
    setLoading: setIsLoading,
  };
};
