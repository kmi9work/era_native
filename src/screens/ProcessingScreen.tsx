import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import ApiService from '../services/api';

interface ProcessingScreenProps {
  onClose: () => void;
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ onClose }) => {
  const [step, setStep] = useState<'guild' | 'plant' | 'processing'>('guild');
  const [loading, setLoading] = useState(false);
  
  // Гильдии
  const [guilds, setGuilds] = useState<any[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<any>(null);
  
  // Предприятия
  const [guildPlants, setGuildPlants] = useState<any[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<any>(null);
  
  // Формулы переработки
  const [formulaFrom, setFormulaFrom] = useState<any[]>([]);
  const [formulaTo, setFormulaTo] = useState<any[]>([]);
  
  // Введенные значения
  const [inputFrom, setInputFrom] = useState<{[key: string]: string}>({});
  const [inputTo, setInputTo] = useState<{[key: string]: string}>({});
  
  // Результаты расчета
  const [resultTo, setResultTo] = useState<any[]>([]);
  const [resultFrom, setResultFrom] = useState<any[]>([]);
  const [resultChange, setResultChange] = useState<any[]>([]);
  
  // Для сканера штрихкода
  const [digitSequence, setDigitSequence] = useState('');
  const [sequenceTimeout, setSequenceTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const scannerInputRef = useRef<TextInput>(null);

  // Все уровни предприятий с формулами
  const [allPlantLevels, setAllPlantLevels] = useState<any[]>([]);

  useEffect(() => {
    // Загружаем все уровни предприятий при монтировании
    loadAllPlantLevels();
  }, []);

  useEffect(() => {
    if (step === 'guild') {
      loadGuilds();
    }
  }, [step]);

  // Очистка таймаута при размонтировании
  useEffect(() => {
    return () => {
      if (sequenceTimeout) {
        clearTimeout(sequenceTimeout);
      }
    };
  }, [sequenceTimeout]);

  const loadAllPlantLevels = async () => {
    try {
      const data = await ApiService.getAllPlantLevels();
      console.log('=== ALL PLANT LEVELS LOADED ===');
      console.log('Count:', data.length);
      console.log('First item:', JSON.stringify(data[0], null, 2));
      setAllPlantLevels(data);
    } catch (error: any) {
      console.error('Error loading plant levels:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить уровни предприятий');
    }
  };

  const loadGuilds = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getGuilds();
      setGuilds(data);
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPlantAndNavigateToProcessing = async (plantId: string) => {
    setLoading(true);
    try {
      console.log('Plant ID string:', plantId);
      console.log('Parsed ID:', parseInt(plantId));
      
      const data = await ApiService.getPlant(parseInt(plantId));
      console.log('Plant data loaded');
      
      // Проверяем наличие plant_level
      if (!data.plant_level) {
        Alert.alert('Ошибка', 'У предприятия нет уровня');
        setLoading(false);
        return;
      }
      
      // Проверяем категорию предприятия
      if (data.plant_level.plant_type?.plant_category?.id === 1) {
        Alert.alert('Ошибка', 'Это добывающее предприятие. Переработка доступна только для перерабатывающих предприятий');
        setLoading(false);
        return;
      }
      
      // Находим полную информацию о уровне предприятия из загруженных данных
      const plantLevelId = data.plant_level.id;
      const fullPlantLevel = allPlantLevels.find(pl => pl.id === plantLevelId);
      
      if (!fullPlantLevel) {
        Alert.alert('Ошибка', 'Информация об уровне предприятия не найдена');
        setLoading(false);
        return;
      }
      
      // Проверяем наличие формул
      if (!fullPlantLevel.formulas || fullPlantLevel.formulas.length === 0) {
        Alert.alert('Ошибка', 'У предприятия нет формул переработки');
        setLoading(false);
        return;
      }
      
      // Создаем объединенные данные предприятия с полной информацией
      const enrichedPlant = {
        ...data,
        plant_level: {
          ...data.plant_level,
          formulas: fullPlantLevel.formulas,
          formula_conversion: {
            from: fullPlantLevel.formula_from,
            to: fullPlantLevel.formula_to
          }
        }
      };
      
      setSelectedPlant(enrichedPlant);
      setFormulaFrom(fullPlantLevel.formula_from);
      setFormulaTo(fullPlantLevel.formula_to);
      
      // Инициализируем пустые значения ввода
      const emptyFrom: {[key: string]: string} = {};
      const emptyTo: {[key: string]: string} = {};
      
      fullPlantLevel.formula_from.forEach((item: any) => {
        emptyFrom[item.identificator] = '';
      });
      
      fullPlantLevel.formula_to.forEach((item: any) => {
        emptyTo[item.identificator] = '';
      });
      
      setInputFrom(emptyFrom);
      setInputTo(emptyTo);
      setStep('processing');
      
      console.log('Navigated to processing step');
    } catch (error: any) {
      console.error('Error loading plant:', error);
      Alert.alert('Ошибка', error.message || 'Не удалось загрузить предприятие');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGuild = async (guild: any) => {
    setSelectedGuild(guild);
    setLoading(true);
    try {
      const data = await ApiService.getGuildPlants(guild.id);
      setGuildPlants(data);
      setStep('plant');
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlant = async (plant: any) => {
    // Проверяем категорию предприятия
    if (plant.plant_level?.plant_type?.plant_category?.id === 1) {
      Alert.alert('Ошибка', 'Это добывающее предприятие. Переработка доступна только для перерабатывающих предприятий');
      return;
    }
    
    // Находим полную информацию о уровне предприятия из загруженных данных
    const plantLevelId = plant.plant_level?.id;
    const fullPlantLevel = allPlantLevels.find(pl => pl.id === plantLevelId);
    
    if (!fullPlantLevel) {
      Alert.alert('Ошибка', 'Информация об уровне предприятия не найдена');
      return;
    }
    
    // Проверяем наличие формул
    if (!fullPlantLevel.formulas || fullPlantLevel.formulas.length === 0) {
      Alert.alert('Ошибка', 'У предприятия нет формул переработки');
      return;
    }
    
    // Проверяем formula_conversion
    if (!fullPlantLevel.formula_from || !fullPlantLevel.formula_to) {
      Alert.alert('Ошибка', 'У предприятия нет формул переработки');
      return;
    }
    
    // Создаем объединенные данные предприятия с полной информацией
    const enrichedPlant = {
      ...plant,
      plant_level: {
        ...plant.plant_level,
        formulas: fullPlantLevel.formulas,
        formula_conversion: {
          from: fullPlantLevel.formula_from,
          to: fullPlantLevel.formula_to
        }
      }
    };
    
    setSelectedPlant(enrichedPlant);
    setFormulaFrom(fullPlantLevel.formula_from);
    setFormulaTo(fullPlantLevel.formula_to);
    
    // Инициализируем пустые значения ввода
    const emptyFrom: {[key: string]: string} = {};
    const emptyTo: {[key: string]: string} = {};
    
    fullPlantLevel.formula_from.forEach((item: any) => {
      emptyFrom[item.identificator] = '';
    });
    
    fullPlantLevel.formula_to.forEach((item: any) => {
      emptyTo[item.identificator] = '';
    });
    
    setInputFrom(emptyFrom);
    setInputTo(emptyTo);
    setStep('processing');
  };

  // Вспомогательные функции для расчетов (из era_front/src/stores/production.js)
  
  const isResArrayLess = (resArray1: any[], resArray2: any[]): boolean => {
    for (const res1 of resArray1) {
      const var2 = resArray2.find((res2: any) => res1.identificator === res2.identificator);
      if (!var2) return false;
      if (res1.count > var2.count) return false;
    }
    return true;
  };

  const resArrayMult = (resArray: any[], n: number): any[] => {
    return resArray.map(res => ({
      ...res,
      count: res.count * n
    }));
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
      array1.push({...res, count: res.count * sign});
    }
    
    return array1;
  };

  const countRequest = (formula: any, request: any[], way: string): {from: any[], to: any[]} => {
    let n = 0;
    let bucket = JSON.parse(JSON.stringify(formula[way]));
    const formulaPart = formula[way];

    while (
      isResArrayLess(bucket, request) && 
      isResArrayLess(resArrayMult(formula.to, n + 1), formula.max_product)
    ) {
      bucket = resArraySum(bucket, JSON.parse(JSON.stringify(formulaPart)));
      n += 1;
    }

    const to = resArrayMult(formula.to, n);
    const from = resArrayMult(formula.from, n);

    return { from, to };
  };

  const calculateFrom = () => {
    // Расчет: у нас есть ресурсы (from), что получим (to)
    if (!selectedPlant?.plant_level) return;
    
    const plantLevel = selectedPlant.plant_level;
    console.log('=== CALCULATE FROM DEBUG ===');
    console.log('Selected plant:', selectedPlant);
    console.log('Plant level:', plantLevel);
    console.log('Formulas:', plantLevel.formulas);
    console.log('Formulas type:', typeof plantLevel.formulas);
    console.log('Formulas is array:', Array.isArray(plantLevel.formulas));
    
    const formulas = plantLevel.formulas || [];
    
    if (formulas.length === 0) {
      Alert.alert('Ошибка', `У предприятия нет формул. Plant level: ${JSON.stringify(plantLevel, null, 2)}`);
      return;
    }
    
    // Коэффициент (пока без проверки технологий, можно добавить позже)
    const coof = 1;
    
    // Преобразуем request
    const requestCopy = Object.entries(inputFrom).map(([identificator, value]) => ({
      identificator: identificator,
      count: parseInt(value as string || '0'),
      name: formulaFrom.find((r: any) => r.identificator === identificator)?.name || identificator
    })).filter(r => r.count > 0);
    
    if (requestCopy.length === 0) {
      Alert.alert('Ошибка', 'Введите хотя бы одно значение');
      return;
    }
    
    let resultingFrom: any[] = [];
    let resultingTo: any[] = [];
    
    // Проходим по всем формулам
    formulas.forEach((formula: any) => {
      const { from, to } = countRequest(formula, requestCopy, 'from');
      
      // Вычитаем использованные ресурсы из request
      resArraySum(requestCopy, from, -1);
      
      resArraySum(resultingFrom, from);
      resArraySum(resultingTo, to);
    });
    
    // Применяем коэффициент к результату
    resultingTo.forEach(res => {
      res.count = Math.floor(res.count * coof);
    });
    
    setResultTo(resultingTo);
    setResultFrom([]);
    setResultChange(requestCopy);
  };

  const calculateTo = () => {
    // Расчет: нужно получить ресурсы (to), сколько надо (from)
    if (!selectedPlant?.plant_level) return;
    
    const plantLevel = selectedPlant.plant_level;
    const formulas = plantLevel.formulas || [];
    
    if (formulas.length === 0) {
      Alert.alert('Ошибка', 'У предприятия нет формул');
      return;
    }
    
    // Коэффициент (пока без проверки технологий)
    const coof = 1;
    
    // Преобразуем request
    const requestCopy = Object.entries(inputTo).map(([identificator, value]) => ({
      identificator: identificator,
      count: Math.ceil(parseInt(value as string || '0') / coof),
      name: formulaTo.find((r: any) => r.identificator === identificator)?.name || identificator
    })).filter(r => r.count > 0);
    
    if (requestCopy.length === 0) {
      Alert.alert('Ошибка', 'Введите хотя бы одно значение');
      return;
    }
    
    let resultingFrom: any[] = [];
    let resultingTo: any[] = [];
    
    // Проходим по всем формулам
    formulas.forEach((formula: any) => {
      const { from, to } = countRequest(formula, requestCopy, 'to');
      
      // Вычитаем использованные ресурсы из request
      resArraySum(requestCopy, to, -1);
      
      resArraySum(resultingFrom, from);
      resArraySum(resultingTo, to);
    });
    
    // Применяем коэффициент к результату
    resultingTo.forEach(res => {
      res.count = res.count * coof;
    });
    
    setResultFrom(resultingFrom);
    setResultTo([]);
    setResultChange(requestCopy);
  };

  const handleBack = () => {
    if (step === 'guild') {
      onClose();
    } else if (step === 'plant') {
      setStep('guild');
      setSelectedGuild(null);
      setGuildPlants([]);
    } else if (step === 'processing') {
      setStep('plant');
      setSelectedPlant(null);
      setFormulaFrom([]);
      setFormulaTo([]);
      setInputFrom({});
      setInputTo({});
      setResultTo([]);
      setResultFrom([]);
      setResultChange([]);
    }
  };

  const renderGuildSelection = () => {
    return (
      <View style={styles.content}>
        <Text style={styles.stepTitle}>Выберите гильдию</Text>
        <Text style={styles.stepSubtitle}>Или отсканируйте штрихкод для быстрого перехода к переработке</Text>
        
        {/* Индикатор состояния сканера */}
        <View style={styles.scannerStatus}>
          <Text style={styles.scannerStatusText}>
            Сканер готов к работе
          </Text>
          {digitSequence.length > 0 && (
            <Text style={styles.scannerStatusText}>
              Введено: {digitSequence.length}/9 цифр: {digitSequence}
            </Text>
          )}
        </View>
        
        {/* Скрытый TextInput для захвата ввода от сканера */}
        <TextInput
          ref={scannerInputRef}
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
          value=""
          onChangeText={(text) => {
            console.log('=== SCANNER INPUT DEBUG ===');
            console.log('Received text:', text);
            console.log('Current digitSequence:', digitSequence);
            
            // Фильтруем только цифры из входящего текста
            const newDigits = text.replace(/[^0-9]/g, '');
            console.log('New digits only:', newDigits);
            
            // Добавляем новые цифры к существующей последовательности
            const newSequence = digitSequence + newDigits;
            setDigitSequence(newSequence);
            console.log('Updated sequence:', newSequence);
            
            // Если введено 9 цифр, переходим к переработке
            if (newSequence.length >= 9) {
              const fullId = newSequence.substring(0, 9); // Берем первые 9 цифр
              console.log('9 digits detected, navigating to processing with ID:', fullId);
              
              const enterpriseId = parseInt(fullId);
              console.log('Full ID string:', fullId);
              console.log('Parsed enterprise ID:', enterpriseId);
              
              // Загружаем данные предприятия и переходим к переработке
              loadPlantAndNavigateToProcessing(enterpriseId.toString());
              
              setDigitSequence(''); // Сбрасываем последовательность
              scannerInputRef.current?.setNativeProps({ text: '' });
            } else {
              // Очищаем поле для следующего формирования последовательности
              scannerInputRef.current?.setNativeProps({ text: '' });
              
              // Устанавливаем таймаут для сброса последовательности (2 секунды)
              if (sequenceTimeout) {
                clearTimeout(sequenceTimeout);
              }
              const timeout = setTimeout(() => {
                console.log('Sequence timeout, resetting...');
                setDigitSequence('');
                setSequenceTimeout(null);
              }, 2000);
              setSequenceTimeout(timeout);
            }
          }}
          onSubmitEditing={(event) => {
            console.log('onSubmitEditing triggered');
            event.preventDefault();
            return false;
          }}
          onKeyPress={(event) => {
            console.log('onKeyPress triggered:', event.nativeEvent.key);
            if (event.nativeEvent.key === 'Enter') {
              event.preventDefault();
              return false;
            }
          }}
          onFocus={() => {
            console.log('Scanner input focused');
          }}
          onBlur={() => {
            console.log('Scanner input blurred, refocusing...');
            setTimeout(() => {
              scannerInputRef.current?.focus();
            }, 100);
          }}
          keyboardType="numeric"
          maxLength={9}
          autoFocus={true}
          showSoftInputOnFocus={false}
          caretHidden={true}
          blurOnSubmit={false}
          returnKeyType="none"
        />
        
        <ScrollView style={styles.listScroll}>
          {guilds.map((guild) => (
            <TouchableOpacity
              key={guild.id}
              style={styles.itemButton}
              onPress={() => handleSelectGuild(guild)}
            >
              <Text style={styles.itemButtonText}>{guild.name}</Text>
              <Text style={styles.itemButtonArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPlantSelection = () => {
    return (
      <View style={styles.content}>
        <Text style={styles.stepTitle}>Выберите предприятие</Text>
        <Text style={styles.selectedInfo}>Гильдия: {selectedGuild?.name}</Text>
        <Text style={styles.stepSubtitle}>Или отсканируйте штрихкод для быстрого перехода к переработке</Text>
        
        {/* Индикатор состояния сканера */}
        <View style={styles.scannerStatus}>
          <Text style={styles.scannerStatusText}>
            Сканер готов к работе
          </Text>
          {digitSequence.length > 0 && (
            <Text style={styles.scannerStatusText}>
              Введено: {digitSequence.length}/9 цифр: {digitSequence}
            </Text>
          )}
        </View>
        
        {/* Скрытый TextInput для захвата ввода от сканера */}
        <TextInput
          ref={scannerInputRef}
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0 }}
          value=""
          onChangeText={(text) => {
            console.log('=== SCANNER INPUT DEBUG (Plant Selection) ===');
            console.log('Received text:', text);
            console.log('Current digitSequence:', digitSequence);
            
            // Фильтруем только цифры из входящего текста
            const newDigits = text.replace(/[^0-9]/g, '');
            console.log('New digits only:', newDigits);
            
            // Добавляем новые цифры к существующей последовательности
            const newSequence = digitSequence + newDigits;
            setDigitSequence(newSequence);
            console.log('Updated sequence:', newSequence);
            
            // Если введено 9 цифр, переходим к переработке
            if (newSequence.length >= 9) {
              const fullId = newSequence.substring(0, 9); // Берем первые 9 цифр
              console.log('9 digits detected in plant selection, navigating to processing with ID:', fullId);
              
              const enterpriseId = parseInt(fullId);
              console.log('Full ID string:', fullId);
              console.log('Parsed enterprise ID:', enterpriseId);
              
              // Загружаем данные предприятия и переходим к переработке
              loadPlantAndNavigateToProcessing(enterpriseId.toString());
              
              setDigitSequence(''); // Сбрасываем последовательность
              scannerInputRef.current?.setNativeProps({ text: '' });
            } else {
              // Очищаем поле для следующего формирования последовательности
              scannerInputRef.current?.setNativeProps({ text: '' });
              
              // Устанавливаем таймаут для сброса последовательности (2 секунды)
              if (sequenceTimeout) {
                clearTimeout(sequenceTimeout);
              }
              const timeout = setTimeout(() => {
                console.log('Sequence timeout, resetting...');
                setDigitSequence('');
                setSequenceTimeout(null);
              }, 2000);
              setSequenceTimeout(timeout);
            }
          }}
          onSubmitEditing={(event) => {
            console.log('onSubmitEditing triggered');
            event.preventDefault();
            return false;
          }}
          onKeyPress={(event) => {
            console.log('onKeyPress triggered:', event.nativeEvent.key);
            if (event.nativeEvent.key === 'Enter') {
              event.preventDefault();
              return false;
            }
          }}
          onFocus={() => {
            console.log('Scanner input focused (plant selection)');
          }}
          onBlur={() => {
            console.log('Scanner input blurred, refocusing...');
            setTimeout(() => {
              scannerInputRef.current?.focus();
            }, 100);
          }}
          keyboardType="numeric"
          maxLength={9}
          autoFocus={true}
          showSoftInputOnFocus={false}
          caretHidden={true}
          blurOnSubmit={false}
          returnKeyType="none"
        />
        
        {guildPlants.length > 0 ? (
          <ScrollView style={styles.listScroll}>
            {guildPlants.map((plant) => (
              <TouchableOpacity
                key={plant.id}
                style={styles.itemButton}
                onPress={() => handleSelectPlant(plant)}
              >
                <View style={styles.itemButtonContent}>
                  <Text style={styles.itemButtonText}>
                    {plant.plant_level?.plant_type?.name || 'Предприятие'}
                  </Text>
                  <Text style={styles.itemButtonSubtext}>
                    Уровень {plant.plant_level?.level || '?'} • ID: {plant.id}
                  </Text>
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
  };

  const renderProcessing = () => {
    return (
      <ScrollView style={styles.content}>
        <Text style={styles.stepTitle}>Переработка</Text>
        <Text style={styles.selectedInfo}>
          {selectedPlant?.plant_level?.plant_type?.name} (Уровень {selectedPlant?.plant_level?.level})
        </Text>
        <Text style={styles.selectedSubInfo}>ID: {selectedPlant?.id}</Text>

        <View style={styles.processingContainer}>
          {/* Форма: Произвести из ресурсов */}
          <View style={styles.formulaBlock}>
            <Text style={styles.formulaTitle}>Произвести из ресурсов</Text>
            {formulaFrom.map((resource) => (
              <View key={resource.identificator} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{resource.name}</Text>
                <TextInput
                  style={styles.numberInput}
                  value={inputFrom[resource.identificator]}
                  onChangeText={(value) => {
                    setInputFrom({...inputFrom, [resource.identificator]: value});
                    // Очищаем результаты при изменении ввода
                    setResultTo([]);
                    setResultFrom([]);
                    setResultChange([]);
                  }}
                  placeholder="Количество"
                  keyboardType="numeric"
                />
              </View>
            ))}
            <TouchableOpacity
              style={styles.calculateButton}
              onPress={calculateFrom}
            >
              <Text style={styles.calculateButtonText}>Переработать</Text>
            </TouchableOpacity>
          </View>

          {/* Форма: Сколько надо ресурсов */}
          <View style={styles.formulaBlock}>
            <Text style={styles.formulaTitle}>Сколько надо ресурсов?</Text>
            {formulaTo.map((resource) => (
              <View key={resource.identificator} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{resource.name}</Text>
                <TextInput
                  style={styles.numberInput}
                  value={inputTo[resource.identificator]}
                  onChangeText={(value) => {
                    setInputTo({...inputTo, [resource.identificator]: value});
                    // Очищаем результаты при изменении ввода
                    setResultTo([]);
                    setResultFrom([]);
                    setResultChange([]);
                  }}
                  placeholder="Количество"
                  keyboardType="numeric"
                />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.calculateButton, styles.calculateButtonSecondary]}
              onPress={calculateTo}
            >
              <Text style={styles.calculateButtonText}>Посмотреть, сколько надо</Text>
            </TouchableOpacity>
          </View>

          {/* Результаты */}
          {(resultTo.length > 0 || resultFrom.length > 0) && (
            <View style={styles.resultsContainer}>
              {resultTo.length > 0 && (
                <View style={styles.resultBlock}>
                  <Text style={styles.resultTitle}>Выдать игроку:</Text>
                  {resultTo.map((item) => (
                    item.count > 0 && (
                      <Text key={item.identificator} style={styles.resultText}>
                        {item.name}: {item.count}
                      </Text>
                    )
                  ))}
                </View>
              )}

              {resultFrom.length > 0 && (
                <View style={styles.resultBlock}>
                  <Text style={styles.resultTitle}>Столько ресурсов надо:</Text>
                  {resultFrom.map((item) => (
                    item.count > 0 && (
                      <Text key={item.identificator} style={styles.resultText}>
                        {item.name}: {item.count}
                      </Text>
                    )
                  ))}
                </View>
              )}

              {resultChange.length > 0 && (
                <View style={styles.resultBlock}>
                  <Text style={styles.resultTitle}>Остаток:</Text>
                  {resultChange.map((item) => (
                    <Text key={item.identificator} style={styles.resultText}>
                      {item.name}: {item.count}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={handleBack}>
          <Text style={styles.headerBackButtonText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Переработка</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      ) : (
        <>
          {step === 'guild' && renderGuildSelection()}
          {step === 'plant' && renderPlantSelection()}
          {step === 'processing' && renderProcessing()}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1976d2',
  },
  headerBackButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerBackButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  scannerStatus: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  scannerStatusText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '600',
  },
  selectedInfo: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  selectedSubInfo: {
    fontSize: 14,
    color: '#999',
    marginBottom: 20,
  },
  listScroll: {
    flex: 1,
  },
  itemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemButtonContent: {
    flex: 1,
  },
  itemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemButtonSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  itemButtonArrow: {
    fontSize: 24,
    color: '#999',
    marginLeft: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
  processingContainer: {
    marginTop: 10,
  },
  formulaBlock: {
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
  formulaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  calculateButton: {
    backgroundColor: '#1976d2',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  calculateButtonSecondary: {
    backgroundColor: '#4caf50',
  },
  calculateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 10,
  },
  resultBlock: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 5,
  },
});

export default ProcessingScreen;

