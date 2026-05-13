import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image } from 'react-native';
import ResourceItem from '../../ResourceItem';
import type { ProcessingScreenLogic } from '../../hooks/useProcessingScreenLogic';
import type { ProcessingStyles } from './styles';

type MultiEntry = ProcessingScreenLogic['multi']['entries'][number];
type MultiTotals = ProcessingScreenLogic['multi']['totals'];

interface ProcessingMultiContentProps {
  loading: boolean;
  entries: MultiEntry[];
  totals: MultiTotals;
  helpers: ProcessingScreenLogic['helpers'];
  handlers: {
    removeEntry: (plantId: number) => void;
    clearEntries: () => void;
    setEntryInputFromValue: (plantId: number, identificator: string, value: string) => void;
    calculateFrom: () => void;
  };
  styles: ProcessingStyles;
}

const ProcessingMultiContent: React.FC<ProcessingMultiContentProps> = ({
  loading,
  entries,
  totals,
  helpers,
  handlers,
  styles,
}) => {
  const { getResourceInfo, getEntryMaxResourceCount } = helpers;

  if (entries.length === 0) {
    return (
      <View style={styles.multiPlaceholder}>
        <Text style={styles.multiPlaceholderText}>
          Сканируйте штрихкоды предприятий, чтобы добавить их в расчёт. После добавления заполните поля и
          нажмите «Рассчитать результат».
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
        <View>
          {entries.map((entry) => {
            const plantName = entry.plant?.plant_level?.plant_type?.name || 'Предприятие';
            const plantLevel = entry.plant?.plant_level?.level || '?';
            const guildName = entry.guild?.name || '';

            return (
              <View key={entry.plantId} style={styles.multiCard}>
                <View style={styles.multiCardHeader}>
                  <View style={styles.multiCardInfo}>
                    <Text style={styles.multiCardTitle}>{plantName}</Text>
                    <Text style={styles.multiCardSubtitle}>
                      Ур. {plantLevel} • {guildName} • ID: {entry.plantId}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.multiCardRemove}
                    activeOpacity={0.8}
                    onPress={() => handlers.removeEntry(entry.plantId)}
                  >
                    <Text style={styles.multiCardRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {entry.isExtractive ? (
                  <View style={styles.multiExtractionBlock}>
                    <Text style={styles.multiSectionTitle}>Добыча</Text>
                    {(entry.formulaTo || []).map((resource: any) => {
                      const info = getResourceInfo(resource.identificator);
                      return (
                        <ResourceItem
                          key={resource.identificator}
                          identificator={resource.identificator}
                          name={info.name}
                          count={resource.count}
                          imageUrl={info.imageUrl}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <>
                    <Text style={styles.multiSectionTitle}>Входные ресурсы</Text>
                    {(entry.formulaFrom || []).map((resource: any) => {
                      const info = getResourceInfo(resource.identificator);
                      const maxValue = getEntryMaxResourceCount(entry, resource);
                      return (
                        <View key={resource.identificator} style={styles.multiInputRow}>
                          <Image source={{ uri: info.imageUrl }} style={styles.resourceIcon} resizeMode="contain" />
                          <Text style={styles.multiInputLabel}>{info.name} (макс: {maxValue})</Text>
                          <TextInput
                            style={styles.multiInputField}
                            keyboardType="numeric"
                            value={entry.inputFrom[resource.identificator] ?? ''}
                            onChangeText={(val) =>
                              handlers.setEntryInputFromValue(entry.plantId, resource.identificator, val)
                            }
                            placeholder="0"
                          />
                        </View>
                      );
                    })}

                    {entry.resultTo.length > 0 && (
                      <View style={styles.multiResultsBlock}>
                        <Text style={styles.multiResultsTitle}>Результат</Text>
                        {entry.resultTo.map((resource: any) => {
                          const info = getResourceInfo(resource.identificator);
                          return (
                            <ResourceItem
                              key={resource.identificator}
                              identificator={resource.identificator}
                              name={info.name}
                              count={resource.count}
                              imageUrl={info.imageUrl}
                            />
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
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
              {totals.resultTo.map((resource: any) => {
                const info = getResourceInfo(resource.identificator);
                return (
                  <ResourceItem
                    key={resource.identificator}
                    identificator={resource.identificator}
                    name={info.name}
                    count={resource.count}
                    imageUrl={info.imageUrl}
                  />
                );
              })}
            </View>
          )}

          {totals.resultFrom.length > 0 && (
            <View style={styles.multiTotalsSection}>
              <Text style={styles.resultTitle}>Итого требуется</Text>
              {totals.resultFrom.map((resource: any) => {
                const info = getResourceInfo(resource.identificator);
                return (
                  <ResourceItem
                    key={resource.identificator}
                    identificator={resource.identificator}
                    name={info.name}
                    count={resource.count}
                    imageUrl={info.imageUrl}
                  />
                );
              })}
            </View>
          )}

          {totals.resultChange.length > 0 && (
            <View style={styles.multiTotalsSection}>
              <Text style={styles.resultTitle}>Остатки</Text>
              {totals.resultChange.map((resource: any) => {
                const info = getResourceInfo(resource.identificator);
                return (
                  <ResourceItem
                    key={resource.identificator}
                    identificator={resource.identificator}
                    name={info.name}
                    count={resource.count}
                    imageUrl={info.imageUrl}
                  />
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
