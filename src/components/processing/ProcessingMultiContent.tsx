import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import type { TextInput as RNTextInput } from 'react-native';
import ResourceItem from '../../screens/ResourceItem';
import type { ProcessingScreenLogic } from '../../screens/hooks/useProcessingScreenLogic';
import type { ProcessingStyles } from './styles';

type MultiEntry = ProcessingScreenLogic['multi']['entries'][number];
type MultiTotals = ProcessingScreenLogic['multi']['totals'];

interface ProcessingMultiContentHandlers {
  removeEntry: (plantId: number) => void;
  clearEntries: () => void;
  setEntryInputFromValue: (plantId: number, identificator: string, value: string) => void;
  calculateFrom: () => void;
}

interface ProcessingMultiContentProps {
  loading: boolean;
  entries: MultiEntry[];
  totals: MultiTotals;
  handlers: ProcessingMultiContentHandlers;
  helpers: ProcessingScreenLogic['helpers'];
  styles: ProcessingStyles;
}

const ProcessingMultiContent: React.FC<ProcessingMultiContentProps> = ({
  loading,
  entries,
  totals,
  handlers,
  helpers,
  styles,
}) => {
  const inputRefs = useRef<Record<string, RNTextInput | null>>({});

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
      if (currentEntryIndex === -1) {
        return;
      }

      const entry = entries[currentEntryIndex];
      if (!entry) {
        return;
      }

      const resources = entry.formulaFrom || [];
      const currentIndex = resources.findIndex((res: any) => res.identificator === identificator);
      if (currentIndex === -1) {
        return;
      }

      for (let i = currentIndex + 1; i < resources.length; i += 1) {
        const nextKey = `${plantId}:${resources[i].identificator}`;
        const nextRef = inputRefs.current[nextKey];
        if (nextRef) {
          nextRef.focus();
          return;
        }
      }

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

  const renderInputRow = (
    entry: MultiEntry,
    resource: any,
    value: string,
    onChange: (plantId: number, identificator: string, text: string) => void,
  ) => {
    const info = helpers.getResourceInfo(resource.identificator);
    return (
      <View key={resource.identificator} style={styles.tableInputItem}>
        <Image source={{ uri: info.imageUrl }} style={styles.tableInputImage} resizeMode="contain" />
        <TextInput
          style={styles.tableInputField}
          keyboardType="numeric"
          value={value ?? ''}
          blurOnSubmit={false}
          returnKeyType="next"
          ref={registerInputRef(entry.plantId, resource.identificator)}
          onSubmitEditing={() => focusNextInput(entry.plantId, resource.identificator)}
          onChangeText={(text) => onChange(entry.plantId, resource.identificator, text.replace(/[^0-9]/g, ''))}
          placeholder="0"
        />
        <TouchableOpacity
          style={styles.tableMaxButton}
          activeOpacity={0.7}
          onPress={() => {
            const maxValue = helpers.getEntryMaxResourceCount(entry, resource);
            handlers.setEntryInputFromValue(entry.plantId, resource.identificator, String(maxValue || 0));
          }}
        >
          <Text style={styles.tableMaxButtonText}>MAX</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderResultResources = (resources: any[] = []) => {
    if (!resources || resources.length === 0) {
      return <Text style={styles.emptyText}>Нет данных</Text>;
    }

    return (
      <View style={styles.tableResultList}>
        {resources.map((resource) => {
          const info = helpers.getResourceInfo(resource.identificator);
          return (
            <ResourceItem
              key={`${resource.identificator}-${resource.count}`}
              identificator={resource.identificator}
              name={info.name}
              count={resource.count}
              imageUrl={info.imageUrl}
            />
          );
        })}
      </View>
    );
  };

  const renderEntry = (entry: MultiEntry) => {
    const plantName = entry.plant?.plant_level?.plant_type?.name || 'Предприятие';
    const level = entry.plant?.plant_level?.level;
    const guildName = entry.guild?.name || '—';
    const titleName = level ? `${plantName} ${level}` : plantName;
    const title = `${titleName} • #${entry.plantId} • ${guildName}`;
    const resultResources = entry.resultTo.length > 0 ? entry.resultTo : entry.formulaTo;

    return (
      <View key={entry.plantId} style={styles.tableRow}>
        <View style={[styles.tableCell, styles.tableColName]}>
          <Text style={styles.tableNameText}>{title}</Text>
        </View>
        <View style={[styles.tableCell, styles.tableColInput]}>
          {entry.isExtractive || (entry.formulaFrom || []).length === 0 ? (
            <Text style={styles.emptyText}>—</Text>
          ) : (
            <View style={styles.tableInputList}>
              {entry.formulaFrom.map((resource: any) =>
                renderInputRow(entry, resource, entry.inputFrom[resource.identificator] || '', handlers.setEntryInputFromValue),
              )}
            </View>
          )}
        </View>
        <View style={[styles.tableCell, styles.tableColResult]}>
          {renderResultResources(resultResources)}
        </View>
        <View style={[styles.tableCell, styles.tableColAction]}>
          <TouchableOpacity
            style={styles.tableActionButton}
            activeOpacity={0.8}
            onPress={() => handlers.removeEntry(entry.plantId)}
          >
            <Text style={styles.tableActionButtonText}>Удалить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <View style={styles.multiPlaceholder}>
        <Text style={styles.multiPlaceholderText}>
          Сканируйте штрихкоды предприятий, чтобы добавить их в расчёт. После добавления заполните поля и
          используйте кнопки расчёта внизу.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.multiContainer}>
      <View style={styles.multiHeaderRow}>
        <Text style={styles.multiHintText}>
          Сканируйте штрихкоды — предприятие добавится в список. Для перерабатывающих предприятий заполните поля перед
          расчётом.
        </Text>
        <TouchableOpacity style={styles.multiClearButton} activeOpacity={0.8} onPress={handlers.clearEntries}>
          <Text style={styles.multiClearButtonText}>Очистить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.multiScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.tableColName]}>Название</Text>
            <Text style={[styles.tableHeaderCell, styles.tableColInput]}>Исходные ресурсы</Text>
            <Text style={[styles.tableHeaderCell, styles.tableColResult]}>Получить</Text>
            <Text style={[styles.tableHeaderCell, styles.tableColAction]}>Действие</Text>
          </View>
          {entries.map(renderEntry)}
        </View>

        <View style={styles.multiTotalsBlock}>
          <Text style={styles.multiTotalsTitle}>Общий расчёт</Text>
          <View style={styles.multiButtonsRow}>
            <TouchableOpacity style={styles.multiButton} activeOpacity={0.8} onPress={handlers.calculateFrom}>
              <Text style={styles.multiButtonText}>Рассчитать результат</Text>
            </TouchableOpacity>
          </View>

          {totals.resultTo.length > 0 && (
            <View style={styles.multiTotalsSection}>
              <Text style={styles.resultTitle}>Итого выдача</Text>
              {renderResultResources(totals.resultTo)}
            </View>
          )}

          {totals.resultFrom.length > 0 && (
            <View style={styles.multiTotalsSection}>
              <Text style={styles.resultTitle}>Итого требуется</Text>
              {renderResultResources(totals.resultFrom)}
            </View>
          )}

          {totals.resultChange.length > 0 && (
            <View style={styles.multiTotalsSection}>
              <Text style={styles.resultTitle}>Остатки</Text>
              {totals.resultChange.map((resource: any) => {
                const info = helpers.getResourceInfo(resource.identificator);
                return (
                  <Text key={resource.identificator} style={styles.resultText}>
                    {info.name}: {resource.count}
                  </Text>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default ProcessingMultiContent;
