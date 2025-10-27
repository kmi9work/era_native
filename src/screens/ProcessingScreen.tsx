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
  Image,
} from 'react-native';
import ApiService from '../services/api';
import ResourceItem from './ResourceItem';

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
  
  // Все ресурсы для отображения картинок
  const [resources, setResources] = useState<any[]>([]);

  useEffect(() => {
    // Загружаем все уровни предприятий при монтировании
    loadAllPlantLevels();
    loadResources();
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

  const loadResources = async () => {
    try {
      const data = await ApiService.getAllResources();
      setResources(data);
    } catch (error: any) {
      console.error('Failed to load resources:', error);
    }
  };

  // Функция для расчета максимального количества ресурса
  const getMaxResourceCount = (resource: any, isFrom: boolean) => {
    if (!selectedPlant?.plant_level?.formulas) return 0;
    
    const formulas = selectedPlant.plant_level.formulas;
    let maxCount = 0;
    
    if (isFrom) {
      // Для блока "Произвести из ресурсов" (from):
      // Учитываем соотношение between from и to в формуле
      formulas.forEach((formula: any) => {
        const resourceItem = formula.from?.find((r: any) => r.identificator === resource.identificator);
        
        if (resourceItem && resourceItem.count && formula.max_product && Array.isArray(formula.max_product)) {
          // Берём первый ресурс из max_product (обычно один)
          const maxProductItem = formula.max_product[0];
          
          if (maxProductItem && maxProductItem.count) {
            // Находим соответствующий ресурс в to
            const toItem = formula.to?.find((t: any) => t.identificator === maxProductItem.identificator);
            
            if (toItem && toItem.count) {
              // Максимум = count_in_from * max_product / count_in_to
              const contribution = (resourceItem.count * maxProductItem.count) / toItem.count;
              maxCount += contribution;
            }
          }
        }
      });
    } else {
      // Для блока "Сколько надо ресурсов" (to):
      // Максимум = значение из max_product напрямую
      formulas.forEach((formula: any) => {
        const resourceItem = formula.to?.find((r: any) => r.identificator === resource.identificator);
        
        if (resourceItem && formula.max_product && Array.isArray(formula.max_product)) {
          const maxProductItem = formula.max_product.find(
            (mp: any) => mp.identificator === resource.identificator
          );
          
          if (maxProductItem && maxProductItem.count) {
            // Максимум = значение из max_product напрямую
            maxCount = Math.max(maxCount, maxProductItem.count);
          }
        }
      });
    }
    
    return maxCount;
  };

  const getResourceInfo = (identificator: string) => {
    const resource = resources.find(r => r.identificator === identificator);
    const baseURL = ApiService['api'].defaults.baseURL || 'http://192.168.1.101:3000';
    return {
      name: resource?.name || identificator,
      imageUrl: `${baseURL}/images/resources/${identificator}.png`
    };
  };

  const loadGuilds = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getGuilds();
      // Сортируем гильдии по названию
      const sortedData = data.sort((a, b) => a.name.localeCompare(b.name));
      setGuilds(sortedData);
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
      
      const isExtractive = data.plant_level.plant_type?.plant_category?.id === 1;
      
      // Находим полную информацию о уровне предприятия из загруженных данных
      const plantLevelId = data.plant_level.id;
      const fullPlantLevel = allPlantLevels.find(pl => pl.id === plantLevelId);
      
      if (!fullPlantLevel) {
        Alert.alert('Ошибка', 'Информация об уровне предприятия не найдена');
        setLoading(false);
        return;
      }
      
      // Для добывающих предприятий формулы могут отсутствовать, используем только formula_to
      if (isExtractive) {
        // Для добывающих: показываем только что нужно выдать
        const enrichedPlant = {
          ...data,
          plant_level: {
            ...data.plant_level,
            formulas: fullPlantLevel.formulas || [],
            formula_conversion: {
              from: [],
              to: fullPlantLevel.formula_to || []
            }
          }
        };
        
        setSelectedPlant(enrichedPlant);
        setFormulaFrom([]);
        setFormulaTo(fullPlantLevel.formula_to || []);
        setInputFrom({});
        setInputTo({});
      } else {
        // Для перерабатывающих: проверяем наличие формул
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
      }
      
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
      // Сортируем предприятия по названию типа предприятия
      const sortedData = data.sort((a, b) => {
        const nameA = a.plant_level?.plant_type?.name || '';
        const nameB = b.plant_level?.plant_type?.name || '';
        return nameA.localeCompare(nameB);
      });
      setGuildPlants(sortedData);
      setStep('plant');
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlant = async (plant: any) => {
    const isExtractive = plant.plant_level?.plant_type?.plant_category?.id === 1;
    
    // Находим полную информацию о уровне предприятия из загруженных данных
    const plantLevelId = plant.plant_level?.id;
    const fullPlantLevel = allPlantLevels.find(pl => pl.id === plantLevelId);
    
    if (!fullPlantLevel) {
      Alert.alert('Ошибка', 'Информация об уровне предприятия не найдена');
      return;
    }
    
    if (isExtractive) {
      // Для добывающих предприятий: показываем только что нужно выдать
      const enrichedPlant = {
        ...plant,
        plant_level: {
          ...plant.plant_level,
          formulas: fullPlantLevel.formulas || [],
          formula_conversion: {
            from: [],
            to: fullPlantLevel.formula_to || []
          }
        }
      };
      
      setSelectedPlant(enrichedPlant);
      setFormulaFrom([]);
      setFormulaTo(fullPlantLevel.formula_to || []);
      setInputFrom({});
      setInputTo({});
    } else {
      // Для перерабатывающих: проверяем наличие формул
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
    }
    
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
    
    // Сбрасываем данные противоположного блока
    const emptyTo: {[key: string]: string} = {};
    formulaTo.forEach((item: any) => {
      emptyTo[item.identificator] = '';
    });
    setInputTo(emptyTo);
    
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
    
    // Сбрасываем данные противоположного блока
    const emptyFrom: {[key: string]: string} = {};
    formulaFrom.forEach((item: any) => {
      emptyFrom[item.identificator] = '';
    });
    setInputFrom(emptyFrom);
    
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
          style={{ position: 'absolute', top: -1000, left: -1000, opacity: 0, height: 1, width: 1 }}
          pointerEvents="none"
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
          keyboardType="numeric"
          maxLength={9}
          showSoftInputOnFocus={false}
          caretHidden={true}
        />
        
        <ScrollView style={styles.listScroll}>
          {guilds.map((guild) => (
            <TouchableOpacity
              key={guild.id}
              style={styles.itemButton}
              activeOpacity={0.7}
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
        
        {guildPlants.length > 0 ? (
          <ScrollView style={styles.listScroll}>
            {guildPlants.map((plant) => (
              <TouchableOpacity
                key={plant.id}
                style={styles.itemButton}
                activeOpacity={0.7}
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
    const isExtractive = selectedPlant?.plant_level?.plant_type?.plant_category?.id === 1;
    
    return (
      <ScrollView style={styles.content}>
        <View style={styles.processingContainer}>
          {isExtractive ? (
            // Для добывающего предприятия: показываем только что нужно выдать
            <View style={styles.formulaBlock}>
              <Text style={styles.formulaTitle}>Выдать игроку:</Text>
              {formulaTo.map((resource) => {
                const resourceInfo = getResourceInfo(resource.identificator);
                return (
                  <ResourceItem
                    key={resource.identificator}
                    identificator={resource.identificator}
                    name={resourceInfo.name}
                    count={resource.count}
                    imageUrl={resourceInfo.imageUrl}
                  />
                );
              })}
            </View>
          ) : (
            // Для перерабатывающего предприятия: полный функционал
            <>
              {/* Ряд с двумя формами */}
              <View style={styles.formsRow}>
                {/* Форма: Произвести из ресурсов */}
                <View style={styles.formulaBlockHalf}>
                  <Text style={styles.formulaTitle}>Произвести из ресурсов</Text>
                  {formulaFrom.map((resource) => {
                    const resourceInfo = getResourceInfo(resource.identificator);
                    const maxCount = getMaxResourceCount(resource, true);
                    return (
                      <View key={resource.identificator} style={styles.inputGroup}>
                        <Image 
                          source={{ uri: resourceInfo.imageUrl }} 
                          style={styles.resourceIcon}
                          resizeMode="contain"
                        />
                        <TextInput
                          style={styles.numberInputCompact}
                          value={inputFrom[resource.identificator]}
                          onChangeText={(value) => {
                            setInputFrom({...inputFrom, [resource.identificator]: value});
                            // Очищаем результаты при изменении ввода
                            setResultTo([]);
                            setResultFrom([]);
                            setResultChange([]);
                          }}
                          placeholder={resourceInfo.name}
                          keyboardType="numeric"
                          maxLength={4}
                        />
                        <TouchableOpacity
                          style={styles.maxButton}
                          activeOpacity={0.7}
                          onPress={() => {
                            setInputFrom({...inputFrom, [resource.identificator]: maxCount.toString()});
                            // Очищаем результаты при изменении ввода
                            setResultTo([]);
                            setResultFrom([]);
                            setResultChange([]);
                          }}
                        >
                          <Text style={styles.maxButtonText}>Max: {maxCount}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    style={styles.calculateButton}
                    activeOpacity={0.7}
                    onPress={calculateFrom}
                  >
                    <Text style={styles.calculateButtonText}>Переработать</Text>
                  </TouchableOpacity>
                </View>

                {/* Форма: Сколько надо ресурсов */}
                <View style={styles.formulaBlockHalf}>
                  <Text style={styles.formulaTitle}>Сколько надо ресурсов?</Text>
                  {formulaTo.map((resource) => {
                    const resourceInfo = getResourceInfo(resource.identificator);
                    const maxCount = getMaxResourceCount(resource, false);
                    return (
                      <View key={resource.identificator} style={styles.inputGroup}>
                        <Image 
                          source={{ uri: resourceInfo.imageUrl }} 
                          style={styles.resourceIcon}
                          resizeMode="contain"
                        />
                        <TextInput
                          style={styles.numberInputCompact}
                          value={inputTo[resource.identificator]}
                          onChangeText={(value) => {
                            setInputTo({...inputTo, [resource.identificator]: value});
                            // Очищаем результаты при изменении ввода
                            setResultTo([]);
                            setResultFrom([]);
                            setResultChange([]);
                          }}
                          placeholder={resourceInfo.name}
                          keyboardType="numeric"
                          maxLength={4}
                        />
                        <TouchableOpacity
                          style={styles.maxButton}
                          activeOpacity={0.7}
                          onPress={() => {
                            setInputTo({...inputTo, [resource.identificator]: maxCount.toString()});
                            // Очищаем результаты при изменении ввода
                            setResultTo([]);
                            setResultFrom([]);
                            setResultChange([]);
                          }}
                        >
                          <Text style={styles.maxButtonText}>Max: {maxCount}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.calculateButton, styles.calculateButtonSecondary]}
                    activeOpacity={0.7}
                    onPress={calculateTo}
                  >
                    <Text style={styles.calculateButtonText}>Посмотреть</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* Результаты */}
          {(resultTo.length > 0 || resultFrom.length > 0) && (
            <View style={styles.resultsRow}>
              {resultTo.length > 0 && (
                <View style={styles.resultBlockHalf}>
                  <Text style={styles.resultTitle}>Выдать игроку:</Text>
                  {resultTo.map((item) => {
                    if (item.count > 0) {
                      const resourceInfo = getResourceInfo(item.identificator);
                      return (
                        <ResourceItem
                          key={item.identificator}
                          identificator={item.identificator}
                          name={resourceInfo.name}
                          count={item.count}
                          imageUrl={resourceInfo.imageUrl}
                        />
                      );
                    }
                    return null;
                  })}
                </View>
              )}

              {resultFrom.length > 0 && (
                <View style={styles.resultBlockHalf}>
                  <Text style={styles.resultTitle}>Столько ресурсов надо:</Text>
                  {resultFrom.map((item) => {
                    if (item.count > 0) {
                      const resourceInfo = getResourceInfo(item.identificator);
                      return (
                        <ResourceItem
                          key={item.identificator}
                          identificator={item.identificator}
                          name={resourceInfo.name}
                          count={item.count}
                          imageUrl={resourceInfo.imageUrl}
                        />
                      );
                    }
                    return null;
                  })}
                </View>
              )}

              {resultChange.length > 0 && (
                <View style={styles.resultBlockHalf}>
                  <Text style={styles.resultTitle}>Остаток:</Text>
                  {resultChange.map((item) => {
                    const resourceInfo = getResourceInfo(item.identificator);
                    return (
                      <ResourceItem
                        key={item.identificator}
                        identificator={item.identificator}
                        name={resourceInfo.name}
                        count={item.count}
                        imageUrl={resourceInfo.imageUrl}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderHeader = () => {
    const isExtractive = selectedPlant?.plant_level?.plant_type?.plant_category?.id === 1;
    
    // Если выбрано предприятие - показываем его информацию в заголовке
    if (step === 'processing' && selectedPlant) {
      const titleText = isExtractive ? 'Добыча' : 'Переработка';
      const plantInfo = `${selectedPlant.plant_level?.plant_type?.name} • Ур. ${selectedPlant.plant_level?.level} • ID: ${selectedPlant.id}`;
      
      return (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
            <Text style={styles.headerBackButtonText}>Назад</Text>
          </TouchableOpacity>
          <View style={styles.headerCenterRow}>
            <Text style={styles.titleInline}>{titleText}:</Text>
            <Text style={styles.headerInfoInline}>{plantInfo}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      );
    }
    
    // Если выбрана гильдия - показываем её в заголовке
    if (step === 'plant' && selectedGuild) {
      return (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
            <Text style={styles.headerBackButtonText}>Назад</Text>
          </TouchableOpacity>
          <View style={styles.headerCenterRow}>
            <Text style={styles.titleInline}>Переработка:</Text>
            <Text style={styles.headerInfoInline}>{selectedGuild.name}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      );
    }
    
    // Обычный заголовок
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
          <Text style={styles.headerBackButtonText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Переработка</Text>
        <View style={styles.headerSpacer} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      {renderHeader()}

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
    paddingTop: 20,
    backgroundColor: '#1976d2',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerCenterRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  titleInline: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 8,
  },
  headerInfoInline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
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
  listScroll: {
    flex: 1,
  },
  itemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 60,
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
  formsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
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
  formulaBlockHalf: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formulaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resourceIcon: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  numberInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  numberInputCompact: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: 'white',
    minWidth: 80,
    maxWidth: 120,
    textAlign: 'center',
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
  resultsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  resultBlock: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  resultBlockHalf: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 12,
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
  maxLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  maxButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maxButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
});

export default ProcessingScreen;

