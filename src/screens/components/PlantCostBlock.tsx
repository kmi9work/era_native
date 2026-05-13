import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ResourceItem from '../ResourceItem';
import ApiService from '../../services/api';
import { CONFIG } from '../../config';

interface PlantCostBlockProps {
  /** Стоимость в формате { resourceIdentificator: amount } */
  cost: Record<string, number>;
  /** Заголовок блока */
  title?: string;
  /** Если true — показывает что это максимальный уровень */
  isMaxLevel?: boolean;
}

/**
 * Общий компонент отображения стоимости (строительство / улучшение).
 */
export default function PlantCostBlock({
  cost,
  title = 'Стоимость:',
  isMaxLevel = false,
}: PlantCostBlockProps) {
  const [resources, setResources] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    
    const loadResources = async () => {
      try {
        const data = await ApiService.getAllResources();
        setResources(data);
      } catch (error) {
        // ignore
      } finally {
        setLoaded(true);
      }
    };
    loadResources();
  }, []);

  const getImagesBaseUrl = useCallback((): string => {
    const configuredBase = (CONFIG.BACKEND_URL || '').replace(/\/+$/, '').replace(/\/backend$/i, '');
    if (configuredBase) return configuredBase;
    const apiBase = (ApiService['api']?.defaults?.baseURL || '').replace(/\/+$/, '');
    return apiBase.replace(/\/backend$/i, '');
  }, []);

  const getResourceInfo = useCallback(
    (identificator: string) => {
      const resource = resources.find((r) => r.identificator === identificator);
      const baseURL = getImagesBaseUrl();
      return {
        name: resource?.name || identificator,
        imageUrl: `${baseURL}/images/resources/${identificator}.png`,
      };
    },
    [resources, getImagesBaseUrl],
  );

  if (isMaxLevel) {
    return (
      <View style={styles.maxLevelBlock}>
        <Text style={styles.maxLevelText}>Максимальный уровень</Text>
      </View>
    );
  }

  if (!cost || Object.keys(cost).length === 0) {
    return null;
  }

  return (
    <View style={styles.costBlock}>
      <Text style={styles.costTitle}>{title}</Text>
      {Object.entries(cost).map(([resource, amount]) => {
        const info = getResourceInfo(resource);
        return (
          <ResourceItem
            key={resource}
            identificator={resource}
            name={info.name}
            count={amount as number}
            imageUrl={info.imageUrl}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  costBlock: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  costTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 10,
  },
  maxLevelBlock: {
    backgroundColor: '#e0e0e0',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#9e9e9e',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maxLevelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#757575',
  },
});
