import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
} from 'react-native';
import ResourceItem from '../ResourceItem';
import { usePlantProcessingLogic } from '../hooks/usePlantProcessingLogic';

interface ProcessingBlockProps {
  processing: ReturnType<typeof usePlantProcessingLogic>;
  loading?: boolean;
}

/**
 * Общий компонент блока переработки/добычи.
 * Отображает формулы, поля ввода, кнопки расчёта и результаты.
 */
export default function ProcessingBlock({
  processing,
  loading = false,
}: ProcessingBlockProps) {
  const { state } = processing;
  const { isExtractive, formulaFrom, formulaTo, resultTo, resultFrom, resultChange } = state;

  // Определяем что показывать
  const hasProcessingFormulas = formulaFrom.length > 0 || formulaTo.length > 0;
  const showProcessingBlock = hasProcessingFormulas && (!isExtractive || formulaTo.length > 0);

  if (!showProcessingBlock) {
    return null;
  }

  const getResourceInfo = processing.getResourceInfo;
  const getMaxResourceCount = processing.getMaxResourceCount;

  return (
    <View style={styles.processingBlock}>
      <Text style={styles.processingTitle}>
        {isExtractive ? 'Добыча' : 'Переработка'}
      </Text>

      {isExtractive ? (
        // Режим "Добыча" — упрощённый вид, только результат
        <View style={styles.formulaBlock}>
          <Text style={styles.formulaTitle}>Выдать игроку:</Text>
          {formulaTo.length > 0 ? (
            formulaTo.map((resource: any) => {
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
          ) : (
            <Text style={styles.emptyText}>Нет данных</Text>
          )}
        </View>
      ) : (
        // Режим "Переработка" — полный ввод ресурсов и расчёт
        <View style={styles.formulaRow}>
          <View style={styles.formulaBlockHalf}>
            <Text style={styles.formulaTitle}>Исходные ресурсы</Text>
            {formulaFrom.length > 0 ? (
              formulaFrom.map((resource: any) => {
                const info = getResourceInfo(resource.identificator);
                return (
                  <View key={resource.identificator} style={styles.inputGroup}>
                    <View style={styles.inputGroupResource}>
                      <Image
                        source={{ uri: info.imageUrl }}
                        style={styles.resourceIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.resourceName}>{info.name}:</Text>
                      <Text style={styles.resourceCount}>{resource.count}</Text>
                    </View>
                    <View style={styles.inputGroupInputs}>
                      <TextInput
                        style={styles.numberInput}
                        keyboardType="numeric"
                        value={state.inputFrom[resource.identificator] ?? ''}
                        onChangeText={(val: string) => processing.setInputFromValue(resource.identificator, val)}
                        placeholder="0"
                      />
                      <TouchableOpacity
                        style={styles.maxButton}
                        onPress={() => processing.setInputFromValue(
                          resource.identificator,
                          String(getMaxResourceCount(resource, true))
                        )}
                      >
                        <Text style={styles.maxButtonText}>MAX</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>Нет данных</Text>
            )}
            <TouchableOpacity
              style={styles.calculateButton}
              onPress={processing.calculateFrom}
              disabled={loading}
            >
              <Text style={styles.calculateButtonText}>Рассчитать результат</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formulaBlockHalf}>
            <Text style={styles.formulaTitle}>Желаемый результат</Text>
            {formulaTo.length > 0 ? (
              formulaTo.map((resource: any) => {
                const info = getResourceInfo(resource.identificator);
                return (
                  <View key={resource.identificator} style={styles.inputGroup}>
                    <View style={styles.inputGroupResource}>
                      <Image
                        source={{ uri: info.imageUrl }}
                        style={styles.resourceIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.resourceName}>{info.name}:</Text>
                      <Text style={styles.resourceCount}>{resource.count}</Text>
                    </View>
                    <View style={styles.inputGroupInputs}>
                      <TextInput
                        style={styles.numberInput}
                        keyboardType="numeric"
                        value={state.inputTo[resource.identificator] ?? ''}
                        onChangeText={(val: string) => processing.setInputToValue(resource.identificator, val)}
                        placeholder="0"
                      />
                      <TouchableOpacity
                        style={styles.maxButton}
                        onPress={() => processing.setInputToValue(
                          resource.identificator,
                          String(getMaxResourceCount(resource, false))
                        )}
                      >
                        <Text style={styles.maxButtonText}>MAX</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>Нет данных</Text>
            )}
            <TouchableOpacity
              style={[styles.calculateButton, styles.calculateButtonSecondary]}
              onPress={processing.calculateTo}
              disabled={loading}
            >
              <Text style={styles.calculateButtonText}>Рассчитать потребности</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Результаты расчёта */}
      {(!isExtractive || formulaFrom.length > 0) && (resultTo.length > 0 || resultFrom.length > 0 || resultChange.length > 0) && (
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
            <View style={[styles.resultBlock, styles.resultChangeBlock]}>
              <Text style={styles.resultChangeTitle}>Остатки</Text>
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

      {/* Кнопка сбросить */}
      {(!isExtractive || formulaFrom.length > 0) && (resultTo.length > 0 || resultFrom.length > 0 || resultChange.length > 0) && (
        <TouchableOpacity
          style={styles.resetButton}
          onPress={processing.reset}
          disabled={loading}
        >
          <Text style={styles.resetButtonText}>Сбросить</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  processingBlock: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 12,
    textAlign: 'center',
  },
  formulaBlock: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  formulaTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  formulaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  formulaBlockHalf: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
    flexWrap: 'nowrap',
  },
  inputGroupResource: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    flexShrink: 0,
    marginRight: 4,
  },
  inputGroupInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 4,
  },
  resourceIcon: {
    width: 20,
    height: 20,
    marginRight: 4,
  },
  resourceName: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
    flexShrink: 1,
  },
  resourceCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 4,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    width: 55,
    textAlign: 'center',
    fontSize: 13,
    backgroundColor: 'white',
  },
  maxButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  maxButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
  },
  calculateButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  calculateButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  calculateButtonSecondary: {
    backgroundColor: '#2196f3',
  },
  resultsContainer: {
    marginTop: 12,
  },
  resultBlock: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4caf50',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 6,
  },
  resultChangeBlock: {
    borderLeftColor: '#ff9800',
    backgroundColor: '#fff8e1',
  },
  resultChangeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  resetButton: {
    backgroundColor: '#ff9800',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
});
