import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import ApiService from '../services/api';
import { Guild, AvailablePlaceInfo, PlantLevel, PlantPlace } from '../types';
import ResourceItem from './ResourceItem';
import { BrotherPrinterService } from '../services/BrotherPrinterService';

interface PlantWorkshopScreenProps {
  onClose: () => void;
}

type FilterType = 'all' | 'extractive' | 'processing';

const PlantWorkshopScreen: React.FC<PlantWorkshopScreenProps> = ({ onClose }) => {
  const [step, setStep] = useState<'guild' | 'scenario' | 'newPlant' | 'upgrade'>('guild');
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [loading, setLoading] = useState(false);
  const [resources, setResources] = useState<any[]>([]);

  // Для нового предприятия
  const [availablePlaces, setAvailablePlaces] = useState<AvailablePlaceInfo[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedPlantType, setSelectedPlantType] = useState<AvailablePlaceInfo | null>(null);
  const [plantLevels, setPlantLevels] = useState<PlantLevel[]>([]);
  const [firstLevel, setFirstLevel] = useState<PlantLevel | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlantPlace | null>(null);

  // Для улучшения
  const [plantId, setPlantId] = useState('');
  const [plantInfo, setPlantInfo] = useState<any>(null);
  const [upgradeCost, setUpgradeCost] = useState<Record<string, number> | null>(null);
  const [guildPlants, setGuildPlants] = useState<any[]>([]);
  const [selectedPlantForUpgrade, setSelectedPlantForUpgrade] = useState<any>(null);
  const [digitSequence, setDigitSequence] = useState('');
  const [sequenceTimeout, setSequenceTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Для модального окна ошибок
  const scannerInputRef = useRef<TextInput>(null);

  // Константы категорий (должны совпадать с бэкендом)
  const EXTRACTIVE = 1;
  const PROCESSING = 2;

  useEffect(() => {
    loadGuilds();
    loadResources();
  }, []);

  // Очистка таймаута при размонтировании
  useEffect(() => {
    return () => {
      if (sequenceTimeout) {
        clearTimeout(sequenceTimeout);
      }
    };
  }, [sequenceTimeout]);

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

  const loadResources = async () => {
    try {
      const data = await ApiService.getAllResources();
      setResources(data);
    } catch (error: any) {
      console.error('Failed to load resources:', error);
    }
  };

  const getResourceInfo = (identificator: string) => {
    const resource = resources.find(r => r.identificator === identificator);
    const baseURL = ApiService['api'].defaults.baseURL || 'http://192.168.1.101:3000';
    return {
      name: resource?.name || identificator,
      imageUrl: `${baseURL}/images/resources/${identificator}.png`
    };
  };

  const handleSelectGuild = (guild: Guild) => {
    setSelectedGuild(guild);
    setStep('scenario');
  };

  // Функция для загрузки предприятия по ID и перехода к улучшению
  const loadPlantAndNavigateToUpgrade = async (plantId: string) => {
    try {
      console.log('=== LOADING PLANT DEBUG ===');
      console.log('Plant ID string:', plantId);
      console.log('Parsed ID:', parseInt(plantId));
      
      const data = await ApiService.getPlant(parseInt(plantId));
      console.log('Plant data loaded:', data);
      
      if (data && data.economic_subject_id) {
        console.log('Plant data is valid, economic_subject_id:', data.economic_subject_id);
        
        // Находим гильдию по ID
        const guild = guilds.find(g => g.id === data.economic_subject_id);
        console.log('Available guilds:', guilds.map(g => ({ id: g.id, name: g.name })));
        console.log('Looking for guild with ID:', data.economic_subject_id);
        
        if (guild) {
          setSelectedGuild(guild);
          console.log('Guild found:', guild.name);
        } else {
          console.error('Guild not found for ID:', data.economic_subject_id);
          Alert.alert('Ошибка', 'Не удалось найти гильдию для предприятия');
          return;
        }
        
        // Устанавливаем данные предприятия
        setPlantInfo(data);
        setSelectedPlantForUpgrade(data);
        
        // Загружаем стоимость улучшения
        const plantTypeId = data.plant_type?.id;
        if (plantTypeId) {
          const levels = await ApiService.getPlantLevels(plantTypeId);
          const currentLevel = data.level || 1;
          const nextLevel = levels.find(l => l.level === currentLevel + 1);
          
          if (nextLevel) {
            setUpgradeCost(nextLevel.price);
            console.log('Upgrade cost loaded:', nextLevel.price);
          } else {
            console.log('No next level found, enterprise at max level');
            Alert.alert('Информация', 'Предприятие уже максимального уровня');
            return;
          }
        }
        
        // Переходим к странице улучшения
        setStep('upgrade');
        console.log('Navigated to upgrade step');
      } else {
        console.error('Invalid plant data or no economic_subject_id');
        console.log('Data received:', data);
        Alert.alert('Ошибка', 'Не удалось загрузить данные предприятия');
      }
    } catch (error) {
      console.error('Error loading plant:', error);
      Alert.alert('Ошибка', 'Предприятие с таким ID не найдено');
    }
  };


  const handleSelectScenario = async (scenario: 'new' | 'upgrade') => {
    if (scenario === 'new') {
      setLoading(true);
      try {
        const data = await ApiService.getAvailablePlaces();
        setAvailablePlaces(data);
        setStep('newPlant');
      } catch (error: any) {
        Alert.alert('Ошибка', error.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Загружаем предприятия гильдии
      if (selectedGuild) {
        setLoading(true);
        try {
          const plants = await ApiService.getGuildPlants(selectedGuild.id);
          setGuildPlants(plants);
        } catch (error: any) {
          console.error('Failed to load guild plants:', error);
        } finally {
          setLoading(false);
        }
      }
      setStep('upgrade');
    }
  };

  const handleSelectPlantType = async (plantTypeInfo: AvailablePlaceInfo) => {
    setSelectedPlantType(plantTypeInfo);
    setLoading(true);
    try {
      const levels = await ApiService.getPlantLevels(plantTypeInfo.plant_type_id);
      setPlantLevels(levels);
      const first = levels.find(l => l.level === 1);
      setFirstLevel(first || null);
      
      // Если только одно доступное место - выбираем его автоматически
      if (plantTypeInfo.available_places.length === 1) {
        setSelectedPlace(plantTypeInfo.available_places[0]);
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildPlant = async () => {
    // Если место не выбрано явно, но доступно только одно - используем его
    const placeToUse = selectedPlace || 
      (selectedPlantType && selectedPlantType.available_places.length === 1 
        ? selectedPlantType.available_places[0] 
        : null);

    if (!selectedGuild || !firstLevel || !placeToUse) {
      Alert.alert('Ошибка', 'Не все данные заполнены');
      return;
    }

    setLoading(true);
    let createdPlant: any = null;

    try {
      // Создаем предприятие
      createdPlant = await ApiService.createPlant({
        plant_level_id: firstLevel.id,
        plant_place_id: placeToUse.id,
        economic_subject: `${selectedGuild.id}_Guild`,
      });


      console.log('=== RAW RESPONSE DEBUG ===');
      console.log('CreatedPlant raw response:', JSON.stringify(createdPlant, null, 2));
      console.log('CreatedPlant type:', typeof createdPlant);
      console.log('CreatedPlant keys:', Object.keys(createdPlant || {}));
      
      // Проверяем различные возможные форматы ответа
      let plantData = createdPlant;
      
      // Rails может возвращать данные в разных форматах
      if (createdPlant && createdPlant.plant) {
        plantData = createdPlant.plant;
        console.log('Using createdPlant.plant:', plantData);
      } else if (createdPlant && createdPlant.data) {
        plantData = createdPlant.data;
        console.log('Using createdPlant.data:', plantData);
      } else {
        console.log('Using createdPlant directly:', plantData);
      }

      // Проверяем, что мы получили корректный ответ
      if (!plantData || typeof plantData.id === 'undefined') {
        const errorMessage = 'Не удалось получить ID созданного предприятия';
        const errorData = {
          createdPlant,
          plantData,
          error: 'ID field is undefined or null'
        };
        
        throw new Error(errorMessage);
      }

      // Форматируем ID в формат %09d (9 цифр с ведущими нулями)
      const formattedPlantId = plantData.id.toString().padStart(9, '0');
      
      console.log('=== PLANT WORKSHOP DEBUG ===');
      console.log('PlantData:', plantData);
      console.log('PlantData.id:', plantData.id);
      console.log('FormattedPlantId:', formattedPlantId);
      
      // Получаем информацию о гильдии и регионе
      const guildName = selectedGuild?.name || 'Неизвестная гильдия';
      const regionName = placeToUse?.name || 'Неизвестный регион';
      
      console.log('GuildName:', guildName);
      console.log('RegionName:', regionName);
      
      // Пытаемся напечатать штрихкод с полной информацией
      const printResult = await BrotherPrinterService.printBarcode(plantData.id, guildName, regionName);
      
      if (printResult.success) {
        Alert.alert('Успех', `Предприятие успешно построено!\nID: ${plantData.id}\nШтрихкод напечатан.`);
        
        // Сброс состояния
        setSelectedPlantType(null);
        setFirstLevel(null);
        setSelectedPlace(null);
        setStep('guild');
      } else {
        // Печать неудачна - откатываем создание предприятия
        console.error('Ошибка печати:', printResult.error);
        
        try {
          await ApiService.deletePlant(plantData.id);
        } catch (deleteError) {
          console.error('Ошибка удаления предприятия:', deleteError);
        }
        
        Alert.alert(
          'Ошибка печати',
          `Не удалось напечатать штрихкод: ${printResult.error}\n\nПредприятие не было создано. Проверьте настройки принтера.`
        );
      }
    } catch (error: any) {
      console.error('Ошибка создания предприятия:', error);
      
      // Логируем ошибку для детального анализа
      
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPlant = async (id?: string) => {
    const idToLoad = id || plantId;
    if (!idToLoad.trim()) {
      Alert.alert('Ошибка', 'Введите ID предприятия');
      return;
    }

    setLoading(true);
    try {
      const data = await ApiService.getPlant(parseInt(idToLoad));
      
      // В ответе plant_type находится на верхнем уровне из-за partial
      const plantTypeId = data.plant_type?.id;
      const currentLevel = data.level || 1;
      
      if (!plantTypeId) {
        Alert.alert('Ошибка', 'Не удалось определить тип предприятия');
        return;
      }
      
      // Получить информацию о стоимости улучшения
      const levels = await ApiService.getPlantLevels(plantTypeId);
      const nextLevel = levels.find(l => l.level === currentLevel + 1);
      
      if (nextLevel) {
        // Переход на экран подтверждения
        setPlantInfo(data);
        setUpgradeCost(nextLevel.price);
        setSelectedPlantForUpgrade(data);
      } else {
        Alert.alert('Информация', 'Предприятие уже максимального уровня');
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlant = (plant: any) => {
    const formattedId = plant.id.toString().padStart(9, '0');
    setPlantId(formattedId);
    handleLoadPlant(formattedId);
  };

  const handleUpgradePlant = async () => {
    if (!selectedPlantForUpgrade?.id) {
      Alert.alert('Ошибка', 'Предприятие не выбрано');
      return;
    }

    setLoading(true);
    try {
      const result = await ApiService.upgradePlant(selectedPlantForUpgrade.id);
      Alert.alert('Успех', result.msg || 'Предприятие успешно улучшено!');
      
      // Сброс состояния и возврат к выбору гильдии
      setSelectedPlantForUpgrade(null);
      setPlantInfo(null);
      setUpgradeCost(null);
      setPlantId('');
      setStep('guild');
    } catch (error: any) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredPlantTypes = () => {
    let filtered;
    if (filterType === 'all') {
      filtered = availablePlaces;
    } else if (filterType === 'extractive') {
      filtered = availablePlaces.filter(p => p.plant_category_id === EXTRACTIVE);
    } else {
      filtered = availablePlaces.filter(p => p.plant_category_id === PROCESSING);
    }
    
    // Сортируем: доступные предприятия в начале, недоступные в конце
    return filtered.sort((a, b) => {
      const aAvailable = a.available_places.length > 0 ? 1 : 0;
      const bAvailable = b.available_places.length > 0 ? 1 : 0;
      return bAvailable - aAvailable;
    });
  };

  const renderGuildSelection = () => (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Выберите гильдию</Text>
      <Text style={styles.stepSubtitle}>Или отсканируйте штрихкод для быстрого перехода к улучшению предприятия</Text>
      
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
          
          // Если введено 9 цифр, переходим к улучшению
          if (newSequence.length >= 9) {
            const fullId = newSequence.substring(0, 9); // Берем первые 9 цифр
            console.log('9 digits detected, navigating to upgrade with ID:', fullId);
            
            // Сохраняем ID как строку для отображения, но используем числовой ID для API
            const enterpriseId = parseInt(fullId);
            console.log('Full ID string:', fullId);
            console.log('Parsed enterprise ID:', enterpriseId);
            
            setPlantId(enterpriseId.toString());
            
            // Загружаем данные предприятия и переходим к улучшению
            loadPlantAndNavigateToUpgrade(enterpriseId.toString());
            
            setDigitSequence(''); // Сбрасываем последовательность
            // Принудительно очищаем поле
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
          // Блокируем стандартное поведение Enter
          event.preventDefault();
          return false;
        }}
        onKeyPress={(event) => {
          console.log('onKeyPress triggered:', event.nativeEvent.key);
          // Блокируем Enter и другие служебные клавиши
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
          // Восстанавливаем фокус если он потерялся
          setTimeout(() => {
            scannerInputRef.current?.focus();
          }, 100);
        }}
        keyboardType="numeric"
        maxLength={9}
        autoFocus={true}
        showSoftInputOnFocus={false} // Скрываем клавиатуру
        caretHidden={true} // Скрываем курсор
        blurOnSubmit={false} // Не теряем фокус при Enter
        returnKeyType="none" // Убираем кнопку отправки
      />
      
      {loading ? (
        <ActivityIndicator size="large" color="#1976d2" />
      ) : (
        <ScrollView>
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
      )}
    </View>
  );

  const renderScenarioSelection = () => (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Выберите действие</Text>
      <Text style={styles.selectedInfo}>Гильдия: {selectedGuild?.name}</Text>
      
      <TouchableOpacity
        style={styles.scenarioButton}
        onPress={() => handleSelectScenario('new')}
      >
        <Text style={styles.scenarioButtonIcon}>➕</Text>
        <View style={styles.scenarioButtonContent}>
          <Text style={styles.scenarioButtonText}>Новое предприятие</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.scenarioButton}
        onPress={() => handleSelectScenario('upgrade')}
      >
        <Text style={styles.scenarioButtonIcon}>⬆️</Text>
        <View style={styles.scenarioButtonContent}>
          <Text style={styles.scenarioButtonText}>Улучшение предприятия</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderNewPlant = () => {
    if (!selectedPlantType) {
      const filteredPlants = getFilteredPlantTypes();
      
      return (
        <View style={styles.content}>
          <Text style={styles.stepTitle}>Выберите тип предприятия</Text>
          <Text style={styles.selectedInfo}>Гильдия: {selectedGuild?.name}</Text>
          
          {/* Фильтры */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
                Все
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'extractive' && styles.filterButtonActive]}
              onPress={() => setFilterType('extractive')}
            >
              <Text style={[styles.filterButtonText, filterType === 'extractive' && styles.filterButtonTextActive]}>
                Добывающие
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'processing' && styles.filterButtonActive]}
              onPress={() => setFilterType('processing')}
            >
              <Text style={[styles.filterButtonText, filterType === 'processing' && styles.filterButtonTextActive]}>
                Перерабатывающие
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#1976d2" />
          ) : (
            <ScrollView style={styles.plantTypesList}>
              {filteredPlants.map((plantType) => (
                <TouchableOpacity
                  key={plantType.plant_type_id}
                  style={[
                    styles.itemButton,
                    plantType.available_places.length === 0 && styles.itemButtonDisabled
                  ]}
                  onPress={() => handleSelectPlantType(plantType)}
                  disabled={plantType.available_places.length === 0}
                >
                  <Text style={[
                    styles.itemButtonText,
                    plantType.available_places.length === 0 && styles.itemButtonTextDisabled
                  ]}>
                    {plantType.plant_type_name}
                  </Text>
                  <Text style={styles.itemButtonArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      );
    }

    // Если есть несколько доступных мест и место еще не выбрано
    if (selectedPlantType.available_places.length > 1 && !selectedPlace) {
      return (
        <View style={styles.content}>
          <Text style={styles.stepTitle}>{selectedPlantType.plant_type_name}</Text>
          <Text style={styles.selectedInfo}>Гильдия: {selectedGuild?.name}</Text>
          
          {firstLevel && (
            <View style={styles.costBlock}>
              <Text style={styles.costTitle}>Стоимость строительства:</Text>
              {Object.entries(firstLevel.price).map(([resource, amount]) => {
                const resourceInfo = getResourceInfo(resource);
                return (
                  <ResourceItem
                    key={resource}
                    identificator={resource}
                    name={resourceInfo.name}
                    count={amount as number}
                    imageUrl={resourceInfo.imageUrl}
                  />
                );
              })}
            </View>
          )}

          <Text style={styles.sectionTitle}>Выберите место строительства:</Text>
          <ScrollView style={styles.placesList}>
            {selectedPlantType.available_places.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={styles.itemButton}
                onPress={() => setSelectedPlace(place)}
              >
                <Text style={styles.itemButtonText}>{place.region_name}</Text>
                <Text style={styles.itemButtonArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Определяем место для отображения
    const placeToShow = selectedPlace || 
      (selectedPlantType.available_places.length === 1 
        ? selectedPlantType.available_places[0] 
        : null);

    return (
      <View style={styles.content}>
        <Text style={styles.stepTitle}>Подтверждение строительства</Text>
        <Text style={styles.selectedInfo}>Гильдия: {selectedGuild?.name}</Text>
        
        <View style={styles.confirmBlock}>
          <Text style={styles.confirmLabel}>Тип предприятия:</Text>
          <Text style={styles.confirmValue}>{selectedPlantType.plant_type_name}</Text>
          
          <Text style={styles.confirmLabel}>Место строительства:</Text>
          <Text style={styles.confirmValue}>{placeToShow?.region_name || 'Не выбрано'}</Text>
          
          <Text style={styles.confirmLabel}>Гильдия:</Text>
          <Text style={styles.confirmValue}>{selectedGuild?.name}</Text>
        </View>

        {firstLevel && (
          <View style={styles.costBlock}>
            <Text style={styles.costTitle}>Стоимость:</Text>
            {Object.entries(firstLevel.price).map(([resource, amount]) => {
              const resourceInfo = getResourceInfo(resource);
              return (
                <ResourceItem
                  key={resource}
                  identificator={resource}
                  name={resourceInfo.name}
                  count={amount as number}
                  imageUrl={resourceInfo.imageUrl}
                />
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleBuildPlant}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Создание и печать...' : 'Построить'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderUpgrade = () => {
    // Если предприятие выбрано - показываем экран подтверждения
    if (selectedPlantForUpgrade && upgradeCost) {
      return (
        <View style={styles.content}>
          <Text style={styles.stepTitle}>Подтверждение улучшения</Text>
          <Text style={styles.selectedInfo}>Гильдия: {selectedGuild?.name}</Text>
          
          <View style={styles.confirmBlock}>
            <Text style={styles.confirmLabel}>Тип предприятия:</Text>
            <Text style={styles.confirmValue}>{selectedPlantForUpgrade.plant_type?.name || 'N/A'}</Text>
            
            <Text style={styles.confirmLabel}>Текущий уровень:</Text>
            <Text style={styles.confirmValue}>{selectedPlantForUpgrade.level || 'N/A'}</Text>
            
            <Text style={styles.confirmLabel}>ID предприятия:</Text>
            <Text style={styles.confirmValue}>{selectedPlantForUpgrade.id?.toString().padStart(9, '0') || 'N/A'}</Text>
          </View>

          <View style={styles.costBlock}>
            <Text style={styles.costTitle}>Стоимость улучшения:</Text>
            {Object.entries(upgradeCost).map(([resource, amount]) => {
              const resourceInfo = getResourceInfo(resource);
              return (
                <ResourceItem
                  key={resource}
                  identificator={resource}
                  name={resourceInfo.name}
                  count={amount as number}
                  imageUrl={resourceInfo.imageUrl}
                />
              );
            })}
          </View>
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleUpgradePlant}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Улучшение...' : 'Улучшить'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Экран выбора предприятия
    return (
      <View style={styles.content}>
        <Text style={styles.stepTitle}>Улучшение предприятия</Text>
        <Text style={styles.selectedInfo}>Гильдия: {selectedGuild?.name}</Text>

        {guildPlants.length > 0 && (
          <View style={styles.plantsListContainer}>
            <Text style={styles.sectionTitle}>Предприятия гильдии:</Text>
            <ScrollView style={styles.plantsListScroll}>
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
          </View>
        )}
      </View>
    );
  };

  const handleBack = () => {
    if (step === 'guild') {
      onClose();
    } else if (step === 'scenario') {
      setStep('guild');
    } else if (step === 'newPlant') {
      if (selectedPlace) {
        setSelectedPlace(null);
      } else if (selectedPlantType) {
        setSelectedPlantType(null);
        setSelectedPlace(null);
      } else {
        setStep('scenario');
      }
    } else if (step === 'upgrade') {
      if (selectedPlantForUpgrade) {
        // Вернуться к выбору предприятия
        setSelectedPlantForUpgrade(null);
        setPlantInfo(null);
        setUpgradeCost(null);
      } else {
        setStep('scenario');
      }
    }
  };

  return (
    <View 
      style={styles.container}
      onKeyPress={(event) => {
        console.log('=== CONTAINER KEYPRESS DEBUG ===');
        console.log('Key pressed:', event.key);
        console.log('Current step:', step);
        
        if (step === 'guild') {
          if (/[0-9]/.test(event.key)) {
            // Добавляем новый символ к существующей последовательности
            const newSequence = digitSequence + event.key;
            setDigitSequence(newSequence);
            console.log('Container - Updated sequence:', newSequence);
            
            if (newSequence.length === 9) {
              console.log('9 digits detected in container, navigating to upgrade');
              
              const enterpriseId = parseInt(newSequence);
              console.log('Container - Full ID string:', newSequence);
              console.log('Container - Parsed enterprise ID:', enterpriseId);
              
              setPlantId(enterpriseId.toString());
              loadPlantAndNavigateToUpgrade(enterpriseId.toString());
              setDigitSequence('');
            }
          }
        }
      }}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={handleBack}>
          <Text style={styles.headerBackButtonText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Предприятия</Text>
        <View style={styles.headerSpacer} />
      </View>

      {step === 'guild' && renderGuildSelection()}
      {step === 'scenario' && renderScenarioSelection()}
      {step === 'newPlant' && renderNewPlant()}
      {step === 'upgrade' && renderUpgrade()}

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
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scannerStatus: {
    backgroundColor: '#e8f5e8',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  scannerStatusText: {
    fontSize: 12,
    color: '#2e7d32',
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedInfo: {
    fontSize: 14,
    color: '#1976d2',
    marginBottom: 20,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  plantTypesList: {
    flex: 1,
  },
  itemButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
  itemButtonDisabled: {
    opacity: 0.4,
  },
  itemButtonSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#1976d2',
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
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  itemButtonTextDisabled: {
    color: '#999',
  },
  itemButtonArrow: {
    fontSize: 24,
    color: '#999',
  },
  scenarioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scenarioButtonIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  scenarioButtonContent: {
    flex: 1,
  },
  scenarioButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  placesList: {
    flex: 1,
  },
  plantsListContainer: {
    flex: 1,
    marginBottom: 20,
  },
  plantsListScroll: {
    flex: 1,
  },
  confirmBlock: {
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
  confirmLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  plantInfoBlock: {
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
  plantInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  plantInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  primaryButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
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
});

export default PlantWorkshopScreen;
