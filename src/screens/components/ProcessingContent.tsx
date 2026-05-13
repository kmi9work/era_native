import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, RefreshControl } from 'react-native';
import ResourceItem from '../ResourceItem';
import type { ProcessingScreenLogic } from '../hooks/useProcessingScreenLogic';
import type { ProcessingStyles } from './processing/styles';

type Step = ProcessingScreenLogic['state']['step'];

type ProcessingSelections = ProcessingScreenLogic['selections'];
type ProcessingFormulas = ProcessingScreenLogic['formulas'];
type ProcessingInputs = ProcessingScreenLogic['inputs'];
type ProcessingResults = ProcessingScreenLogic['results'];

interface ProcessingContentProps {
  step: Step;
  loading: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  selections: ProcessingSelections;
  formulas: ProcessingFormulas;
  inputs: ProcessingInputs;
  results: ProcessingResults;
  processingMeta: ProcessingScreenLogic['processingMeta'];
  helpers: ProcessingScreenLogic['helpers'];
  handlers: Pick<ProcessingScreenLogic['handlers'], 'handleSelectGuild' | 'handleSelectPlant' | 'calculateFrom' | 'calculateTo'>;
  styles: ProcessingStyles;
}

const ProcessingContent: React.FC<ProcessingContentProps> = ({
  step,
  loading,
  refreshing,
  onRefresh,
  selections,
  formulas,
  inputs,
  results,
  processingMeta,
  helpers,
  handlers,
  styles,
}) => {
  const { guilds, selectedGuild, guildPlants, selectedPlant } = selections;
  const { formulaFrom, formulaTo } = formulas;
  const { inputFrom, inputTo, setInputFromValue, setInputToValue } = inputs;
  const { resultFrom, resultTo, resultChange } = results;
  const { isExtractive, displayFormulaTo } = processingMeta;
  const { getResourceInfo, getMaxResourceCount } = helpers;
  const { handleSelectGuild, handleSelectPlant, calculateFrom, calculateTo } = handlers;

  const renderGuildSelection = () => (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Выберите гильдию</Text>
      <Text style={styles.stepSubtitle}>Или отсканируйте штрихкод для быстрого перехода к переработке</Text>

      <View style={styles.scanHintBlock}>
        <Text style={styles.scanHintText}>
          Сканер постоянно подключен. Отсканируйте штрихкод предприятия — приложение загрузит его и откроет экран
          переработки/добычи автоматически.
        </Text>
      </View>

      <ScrollView
        style={styles.listScroll}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined
        }
      >
        {guilds.map((guild) => (
          <TouchableOpacity key={guild.id} style={styles.itemButton} activeOpacity={0.7} onPress={() => handleSelectGuild(guild)}>
            <View style={styles.itemButtonContent}>
              <Text style={styles.itemButtonText}>{guild.name}</Text>
            </View>
            <Text style={styles.itemButtonArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderPlantSelection = () => (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Выберите предприятие</Text>

      {guildPlants.length > 0 ? (
        <ScrollView style={styles.listScroll}>
          {guildPlants.map((plant) => (
            <TouchableOpacity key={plant.id} style={styles.itemButton} activeOpacity={0.7} onPress={() => handleSelectPlant(plant)}>
              <View style={styles.itemButtonContent}>
                <Text style={styles.itemButtonText}>{plant.plant_level?.plant_type?.name || 'Предприятие'}</Text>
                <Text style={styles.itemButtonSubtext}>Уровень {plant.plant_level?.level || '?'} • ID: {plant.id}</Text>
              </View>
              <Text style={styles.itemButtonArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>У гильдии нет предприятий</Text>
      )}
    </View>
  );

  const renderInputRow = (
    resource: any,
    value: string,
    onChange: (next: string) => void,
    maxValue: number,
  ) => {
    const info = getResourceInfo(resource.identificator);
    return (
      <View key={resource.identificator} style={styles.inputGroup}>
        <Image source={{ uri: info.imageUrl }} style={styles.resourceIcon} resizeMode="contain" />
        <View style={styles.resourceInfo}>
          <Text style={styles.resourceName}>{info.name}</Text>
          {maxValue > 0 && <Text style={styles.maxLabel}>Макс: {maxValue}</Text>}
        </View>
        <TextInput
          style={styles.numberInputCompact}
          keyboardType="numeric"
          value={value ?? ''}
          onChangeText={onChange}
          placeholder="0"
        />
        <TouchableOpacity style={styles.maxButton} onPress={() => onChange(String(maxValue || 0))}>
          <Text style={styles.maxButtonText}>MAX</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderProcessing = () => {
    if (!selectedPlant) {
      return (
        <View style={styles.processingPlaceholder}>
          <Text style={styles.processingPlaceholderText}>Выберите предприятие или отсканируйте штрихкод</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.processingContainer}>
        {isExtractive ? (
          <View style={styles.formulaBlock}>
            <Text style={styles.formulaTitle}>Выдать игроку:</Text>
            {(displayFormulaTo || []).length === 0 ? (
              <Text style={styles.emptyText}>Нет ресурсов для выдачи</Text>
            ) : (
              (displayFormulaTo || []).map((resource: any) => {
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
              })
            )}
          </View>
        ) : (
          <>
            <View style={styles.formulaRow}>
              <View style={[styles.formulaBlockHalf, styles.formulaBlockHalfLeft]}>
                <Text style={styles.formulaTitle}>Исходные ресурсы</Text>
                {formulaFrom.length === 0 ? (
                  <Text style={styles.emptyText}>Нет данных</Text>
                ) : (
                  formulaFrom.map((resource: any) =>
                    renderInputRow(
                      resource,
                      inputFrom[resource.identificator] ?? '',
                      (next) => setInputFromValue(resource.identificator, next),
                      getMaxResourceCount(resource, true),
                    ),
                  )
                )}
                <TouchableOpacity style={styles.calculateButton} onPress={calculateFrom}>
                  <Text style={styles.calculateButtonText}>Рассчитать результат</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.formulaBlockHalf, styles.formulaBlockHalfRight]}>
                <Text style={styles.formulaTitle}>Желаемый результат</Text>
                {formulaTo.length === 0 ? (
                  <Text style={styles.emptyText}>Нет данных</Text>
                ) : (
                  formulaTo.map((resource: any) =>
                    renderInputRow(
                      resource,
                      inputTo[resource.identificator] ?? '',
                      (next) => setInputToValue(resource.identificator, next),
                      getMaxResourceCount(resource, false),
                    ),
                  )
                )}
                <TouchableOpacity
                  style={[styles.calculateButton, styles.calculateButtonSecondary]}
                  onPress={calculateTo}
                >
                  <Text style={styles.calculateButtonText}>Рассчитать потребности</Text>
                </TouchableOpacity>
              </View>
            </View>

            {(resultTo.length > 0 || resultFrom.length > 0 || resultChange.length > 0) && (
              <View style={styles.resultsContainer}>
                {resultTo.length > 0 && (
                  <View style={styles.resultBlock}>
                    <Text style={styles.resultTitle}>Результат переработки</Text>
                    {resultTo.map((resource: any) => {
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

                {resultFrom.length > 0 && (
                  <View style={styles.resultBlock}>
                    <Text style={styles.resultTitle}>Необходимые ресурсы</Text>
                    {resultFrom.map((resource: any) => {
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

                {resultChange.length > 0 && (
                  <View style={styles.resultBlock}>
                    <Text style={styles.resultTitle}>Остатки</Text>
                    {resultChange.map((resource: any) => {
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
            )}
          </>
        )}
      </ScrollView>
    );
  };

  if (step === 'guild') {
    return renderGuildSelection();
  }

  if (step === 'plant') {
    return renderPlantSelection();
  }

  return renderProcessing();
};

export default ProcessingContent;
