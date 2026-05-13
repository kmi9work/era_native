import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import ResourceItem from '../ResourceItem';
import { useMultiEnterprise } from './multiEnterpriseContext';
import { processingStyles } from '../components/processing/styles';
import ApiService from '../../services/api';
import { CONFIG } from '../../config';

const getBaseUrl = () => {
  const configuredBase = (CONFIG.BACKEND_URL || '').replace(/\/+$/, '').replace(/\/backend$/i, '');
  return configuredBase || (ApiService['api']?.defaults?.baseURL || 'http://192.168.1.38:3000');
};

/**
 * Экран "Много предприятий".
 * Отображает таблицу с предприятиями, полями ввода для перерабатывающих
 * и результатом добычи для добывающих.
 */
export default function MultiEnterprisesScreen() {
  const {
    entries,
    totals,
    isLoading,
    resources,
    removeEntry,
    clearEntries,
    setEntryInputFromValue,
    calculateFrom,
  } = useMultiEnterprise();

  const inputRefs = useRef<Record<string, RNTextInput | null>>({});

  const baseUrl = getBaseUrl();

  const registerInputRef = useCallback((plantId: number, identificator: string) => {
    const key = `${plantId}:${identificator}`;
    return (ref: RNTextInput | null) => {
      if (ref) {
        inputRefs.current[key] = ref;
      } else {
        delete inputRefs.current[key];
      }
    };
  }, []);

  const focusNextInput = useCallback(
    (plantId: number, identificator: string) => {
      const currentEntryIndex = entries.findIndex((item) => item.plantId === plantId);
      if (currentEntryIndex === -1) return;

      const entry = entries[currentEntryIndex];
      if (!entry) return;

      const resources = entry.formulaFrom || [];
      const currentIndex = resources.findIndex((res: any) => res.identificator === identificator);
      if (currentIndex === -1) return;

      // Focus next input in same entry
      for (let i = currentIndex + 1; i < resources.length; i += 1) {
        const nextKey = `${plantId}:${resources[i].identificator}`;
        const nextRef = inputRefs.current[nextKey];
        if (nextRef) {
          nextRef.focus();
          return;
        }
      }

      // Focus first input in next entries
      for (let entryIndex = currentEntryIndex + 1; entryIndex < entries.length; entryIndex += 1) {
        const nextEntry = entries[entryIndex];
        const nextResources = nextEntry.formulaFrom || [];
        for (let j = 0; j < nextResources.length; j += 1) {
          const nextKey = `${nextEntry.plantId}:${nextResources[j].identificator}`;
          const nextRef = inputRefs.current[nextKey];
          if (nextRef) {
            nextRef.focus();
            return;
          }
        }
      }
    },
    [entries],
  );

  const getResourceInfo = useCallback((identificator: string) => {
    const resourceInfo = (resources || []).find((r: any) => r.identificator === identificator);
    return {
      name: resourceInfo?.name || identificator,
      imageUrl: `${baseUrl}/images/resources/${identificator}.png`,
    };
  }, [baseUrl, resources]);

  const getEntryMaxResourceCount = useCallback((entry: any, resource: any): number => {
    if (!entry?.plant?.plant_level?.formulas) return 0;
    const formulas = entry.plant.plant_level.formulas || [];
    let maxCount = 0;
    formulas.forEach((formula: any) => {
      const resourceItem = formula.from?.find((r: any) => r.identificator === resource.identificator);
      if (resourceItem && resourceItem.count && formula.max_product && Array.isArray(formula.max_product)) {
        const maxProductItem = formula.max_product[0];
        if (maxProductItem && maxProductItem.count) {
          const toItem = formula.to?.find((t: any) => t.identificator === maxProductItem.identificator);
          if (toItem && toItem.count) {
            maxCount += (resourceItem.count * maxProductItem.count) / toItem.count;
          }
        }
      }
    });
    return Math.floor(maxCount);
  }, []);

  const renderInputRow = (
    entry: any,
    resource: any,
    value: string,
  ) => {
    const info = getResourceInfo(resource.identificator);
    const maxValue = getEntryMaxResourceCount(entry, resource);
    return (
      <View key={resource.identificator} style={processingStyles.tableInputItem}>
        <Image source={{ uri: info.imageUrl }} style={processingStyles.tableInputImage} resizeMode="contain" />
        <TextInput
          style={processingStyles.tableInputField}
          keyboardType="numeric"
          value={value ?? ''}
          blurOnSubmit={false}
          returnKeyType="next"
          ref={registerInputRef(entry.plantId, resource.identificator)}
          onSubmitEditing={() => focusNextInput(entry.plantId, resource.identificator)}
          onChangeText={(text) => setEntryInputFromValue(entry.plantId, resource.identificator, text.replace(/[^0-9]/g, ''))}
          placeholder="0"
        />
        <TouchableOpacity
          style={processingStyles.tableMaxButton}
          activeOpacity={0.7}
          onPress={() => {
            setEntryInputFromValue(entry.plantId, resource.identificator, String(maxValue || 0));
          }}
        >
          <Text style={processingStyles.tableMaxButtonText}>MAX</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderResultResources = (resources: any[] = []) => {
    if (!resources || resources.length === 0) {
      return <Text style={processingStyles.emptyText}>Нет данных</Text>;
    }

    return (
      <View style={processingStyles.tableResultList}>
        {resources.map((resource) => {
          // Resources coming from calculateFrom already have name/imageUrl added by addResourceMeta in context
          const name = resource.name || resource.identificator;
          const imageUrl = resource.imageUrl || `${baseUrl}/images/resources/${resource.identificator}.png`;
          return (
            <ResourceItem
              key={`${resource.identificator}-${resource.count}`}
              identificator={resource.identificator}
              name={name}
              count={resource.count}
              imageUrl={imageUrl}
            />
          );
        })}
      </View>
    );
  };

  const renderEntry = (entry: any) => {
    const plantName = entry.plant?.plant_level?.plant_type?.name || 'Предприятие';
    const level = entry.plant?.plant_level?.level;
    const guildName = entry.guild?.name || '—';
    const titleName = level ? `${plantName} ${level}` : plantName;
    const title = `${titleName} • #${entry.plantId} • ${guildName}`;
    
    // For extraction plants, show formulaTo; for processing, show calculated resultTo
    const resultResources = entry.resultTo && entry.resultTo.length > 0 
      ? entry.resultTo 
      : entry.formulaTo;

    return (
      <View key={entry.plantId} style={processingStyles.tableRow}>
        <View style={[processingStyles.tableCell, processingStyles.tableColName]}>
          <Text style={processingStyles.tableNameText}>{title}</Text>
        </View>
        <View style={[processingStyles.tableCell, processingStyles.tableColInput]}>
          {entry.isExtractive || (entry.formulaFrom || []).length === 0 ? (
            <Text style={processingStyles.emptyText}>—</Text>
          ) : (
            <View style={processingStyles.tableInputList}>
              {entry.formulaFrom.map((resource: any) =>
                renderInputRow(entry, resource, entry.inputFrom?.[resource.identificator] || ''),
              )}
            </View>
          )}
        </View>
        <View style={[processingStyles.tableCell, processingStyles.tableColResult]}>
          {renderResultResources(resultResources)}
        </View>
        <View style={[processingStyles.tableCell, processingStyles.tableColAction]}>
          <TouchableOpacity
            style={processingStyles.tableActionButton}
            activeOpacity={0.8}
            onPress={() => removeEntry(entry.plantId)}
          >
            <Text style={processingStyles.tableActionButtonText}>Удалить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={processingStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={processingStyles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <View style={processingStyles.multiPlaceholder}>
        <Text style={processingStyles.multiPlaceholderText}>
          Сканируйте штрихкоды предприятий, чтобы добавить их в расчёт. После добавления заполните поля и
          используйте кнопки расчёта внизу.
        </Text>
      </View>
    );
  }

  return (
    <View style={processingStyles.multiContainer}>
      <View style={processingStyles.multiHeaderRow}>
        <Text style={processingStyles.multiHintText}>
          Сканируйте штрихкоды — предприятие добавится в список. Для перерабатывающих предприятий заполните поля перед
          расчётом.
        </Text>
        <TouchableOpacity 
          style={processingStyles.multiClearButton} 
          activeOpacity={0.8} 
          onPress={clearEntries}
        >
          <Text style={processingStyles.multiClearButtonText}>Очистить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={processingStyles.multiScroll} showsVerticalScrollIndicator={false}>
        <View style={processingStyles.table}>
          <View style={processingStyles.tableHeader}>
            <Text style={[processingStyles.tableHeaderCell, processingStyles.tableColName]}>Название</Text>
            <Text style={[processingStyles.tableHeaderCell, processingStyles.tableColInput]}>Исходные ресурсы</Text>
            <Text style={[processingStyles.tableHeaderCell, processingStyles.tableColResult]}>Получить</Text>
            <Text style={[processingStyles.tableHeaderCell, processingStyles.tableColAction]}>Действие</Text>
          </View>
          {entries.map(renderEntry)}
        </View>

        <View style={processingStyles.multiTotalsBlock}>
          <Text style={processingStyles.multiTotalsTitle}>Общий расчёт</Text>
          <View style={processingStyles.multiButtonsRow}>
            <TouchableOpacity 
              style={processingStyles.multiButton} 
              activeOpacity={0.8} 
              onPress={calculateFrom}
            >
              <Text style={processingStyles.multiButtonText}>Рассчитать результат</Text>
            </TouchableOpacity>
          </View>

          {totals.resultTo.length > 0 && (
            <View style={processingStyles.multiTotalsSection}>
              <Text style={processingStyles.resultTitle}>Итого выдача</Text>
              {renderResultResources(totals.resultTo)}
            </View>
          )}

          {totals.resultFrom.length > 0 && (
            <View style={processingStyles.multiTotalsSection}>
              <Text style={processingStyles.resultTitle}>Итого требуется</Text>
              {renderResultResources(totals.resultFrom)}
            </View>
          )}

          {totals.resultChange.length > 0 && (
            <View style={processingStyles.multiTotalsSection}>
              <Text style={processingStyles.resultTitle}>Остатки</Text>
              {renderResultResources(totals.resultChange)}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
