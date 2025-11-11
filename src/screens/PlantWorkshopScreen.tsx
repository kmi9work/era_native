import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import ApiService from '../services/api';
import { Guild, AvailablePlaceInfo, PlantLevel, PlantPlace } from '../types';
import ResourceItem from './ResourceItem';
import { BrotherPrinterService } from '../services/BrotherPrinterService';
import ScannerStatusBadge from '../components/ScannerStatusBadge';
import { useBarcodeScannerContext } from '../context/BarcodeScannerContext';

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

  const { addListener } = useBarcodeScannerContext();
  const lastHandledBarcodeRef = useRef<string | null>(null);

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

  // Константы категорий (должны совпадать с бэкендом)
  const EXTRACTIVE = 1;
  const PROCESSING = 2;

  useEffect(() => {
    loadGuilds();
    loadResources();
  }, []);

  const loadGuilds = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getGuilds();
      // Сортируем гильдии по ID
      const sortedData = data.sort((a, b) => a.id - b.id);
      setGuilds(sortedData);
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
    } catch (error: any) {}
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
  const loadPlantAndNavigateToUpgrade = useCallback(async (plantId: string) => {
    try {
      const data = await ApiService.getPlant(parseInt(plantId));
      
      if (data && data.economic_subject_id) {
        const economicSubject = data.economic_subject;

        // Находим гильдию по ID (список мог ещё не успеть загрузиться)
        let guild = guilds.find(g => g.id === data.economic_subject_id);
        
        if (!guild && economicSubject) {
          const derivedGuild: Guild = {
            id: economicSubject.id ?? data.economic_subject_id,
            name: economicSubject.name || economicSubject.title || `Гильдия #${data.economic_subject_id}`,
          };
          guild = derivedGuild;
          setGuilds(prev => {
            const exists = prev.some(g => g.id === derivedGuild.id);
            return exists ? prev : [...prev, derivedGuild];
          });
        }

        if (guild) {
          setSelectedGuild(guild);
        } else {
          Alert.alert('Ошибка', 'Не удалось найти гильдию для предприятия');
          return;
        }
        
        // Устанавливаем данные предприятия
        setPlantInfo(data);
        setSelectedPlantForUpgrade(data);
        
        // Загружаем стоимость улучшения
        const plantTypeId = data.plant_level?.plant_type?.id;
        if (plantTypeId) {
          const levels = await ApiService.getPlantLevels(plantTypeId);
          const currentLevel = data.plant_level?.level || 1;
          const nextLevel = levels.find(l => l.level === currentLevel + 1);
          
          if (nextLevel) {
            setUpgradeCost(nextLevel.price);
          } else {
            Alert.alert('Информация', 'Предприятие уже максимального уровня');
            return;
          }
        }
        
        // Переходим к странице улучшения
        setStep('upgrade');
      } else {
        Alert.alert(
          'Ошибка', 
          'Не удалось загрузить данные предприятия',
          [
            {
              text: 'ОК',
              onPress: () => setStep('guild'),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Ошибка', 
        'Предприятие с таким ID не найдено',
        [
          {
            text: 'ОК',
            onPress: () => setStep('guild'),
          },
        ]
      );
    }
  }, [guilds]);

  // Обработчик завершения сканирования штрихкода
  const handleBarcodeScanned = useCallback((id: string) => {
    const enterpriseId = parseInt(id);
    console.log('[PlantWorkshopScreen] Scan received:', enterpriseId);
    setPlantId(enterpriseId.toString());
    loadPlantAndNavigateToUpgrade(enterpriseId.toString());
    setStep('upgrade'); // Переходим к экрану улучшения
  }, [loadPlantAndNavigateToUpgrade]);

  useEffect(() => {
    console.log('[PlantWorkshopScreen] Register listener');
    const unsubscribe = addListener('plantWorkshop', (code) => {
      console.log('[PlantWorkshopScreen] Listener triggered:', code, 'current step:', step);
      if (!code.trim()) {
        return;
      }
      if (lastHandledBarcodeRef.current === code) {
        return;
      }
      lastHandledBarcodeRef.current = code;
      handleBarcodeScanned(code);
      setTimeout(() => {
        if (lastHandledBarcodeRef.current === code) {
          lastHandledBarcodeRef.current = null;
        }
      }, 500);
    });

    return () => {
      console.log('[PlantWorkshopScreen] Unregister listener');
      unsubscribe();
      lastHandledBarcodeRef.current = null;
    };
  }, [addListener, handleBarcodeScanned, step]);

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
          const sortedPlants = plants.sort((a, b) => (a.id || 0) - (b.id || 0));
          setGuildPlants(sortedPlants);
        } catch (error: any) {
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


      // Проверяем различные возможные форматы ответа
      let plantData = createdPlant;
      
      // Rails может возвращать данные в разных форматах
      if (createdPlant && createdPlant.plant) {
        plantData = createdPlant.plant;
      } else if (createdPlant && createdPlant.data) {
        plantData = createdPlant.data;
      } else {
        plantData = createdPlant;
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
      const formattedPlantId = plantData.id.toString();
      
      // Получаем информацию о гильдии и регионе
      const guildName = selectedGuild?.name || 'Неизвестная гильдия';
      const regionName = placeToUse?.name || 'Неизвестный регион';
      
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
        // Печать неудачна - предлагаем выбор
        // Не выводим ошибку в консоль для OpenStreamFailure
        if (!printResult.error || !printResult.error.includes('OpenStreamFailure')) {
          Alert.alert('Ошибка', printResult.error);
        }
        
        Alert.alert(
          'Ошибка печати',
          `Не удалось напечатать штрихкод: ${printResult.error}\n\nПроверьте настройки принтера.\n\nХотите всё равно создать предприятие без печати?`,
          [
            {
              text: 'Отменить',
              style: 'cancel',
              onPress: async () => {
                // Удаляем предприятие
                try {
                  await ApiService.deletePlant(plantData.id);
                } catch (deleteError: any) {}
              }
            },
            {
              text: 'Всё равно создать',
              onPress: () => {
                Alert.alert('Успех', `Предприятие создано!\nID: ${plantData.id}\n\nШтрихкод не был напечатан. Вы можете распечатать его позже.`);
                
                // Сброс состояния
                setSelectedPlantType(null);
                setFirstLevel(null);
                setSelectedPlace(null);
                setStep('guild');
              }
            }
          ],
          { cancelable: false }
        );
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось создать предприятие');
      setLoading(false);
      return;
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
      
      // В ответе plant_type находится внутри plant_level
      const plantTypeId = data.plant_level?.plant_type?.id;
      const currentLevel = data.plant_level?.level || 1;
      
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
    const formattedId = plant.id.toString();
    setPlantId(formattedId);
    handleLoadPlant(formattedId);
  };

  const handleDeletePlant = async (plant: any) => {
    Alert.alert(
      'Удаление предприятия',
      `Вы уверены, что хотите удалить "${plant.plant_level?.plant_type?.name}" (ID: ${plant.id})?\n\nЭто действие нельзя отменить.`,
      [
        {
          text: 'Отменить',
          style: 'cancel',
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await ApiService.deletePlant(plant.id);
              Alert.alert('Успех', 'Предприятие успешно удалено');
              
              // Обновляем список предприятий
              if (selectedGuild) {
                const plants = await ApiService.getGuildPlants(selectedGuild.id);
                const sortedPlants = plants.sort((a, b) => (a.id || 0) - (b.id || 0));
                setGuildPlants(sortedPlants);
              }
            } catch (error: any) {
              Alert.alert('Ошибка', error.message || 'Не удалось удалить предприятие');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
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
      <Text style={styles.stepSubtitle}>Или отсканируйте штрихкод для быстрого перехода к переработке</Text>
      
      <View style={styles.scanHintBlock}>
        <Text style={styles.scanHintText}>
          Сканер всегда активен. Отсканируйте штрихкод предприятия, и система сразу перейдёт к экрану
          улучшения с кнопкой «Улучшить».
        </Text>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#1976d2" />
      ) : (
        <ScrollView>
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
      )}
    </View>
  );

  const renderScenarioSelection = () => (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Выберите действие</Text>
      
      <TouchableOpacity
        style={styles.scenarioButton}
        activeOpacity={0.7}
        onPress={() => handleSelectScenario('new')}
      >
        <Text style={styles.scenarioButtonIcon}>➕</Text>
        <View style={styles.scenarioButtonContent}>
          <Text style={styles.scenarioButtonText}>Новое предприятие</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.scenarioButton}
        activeOpacity={0.7}
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
          
          {/* Фильтры */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
              activeOpacity={0.7}
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
                Все
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'extractive' && styles.filterButtonActive]}
              activeOpacity={0.7}
              onPress={() => setFilterType('extractive')}
            >
              <Text style={[styles.filterButtonText, filterType === 'extractive' && styles.filterButtonTextActive]}>
                Добывающие
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'processing' && styles.filterButtonActive]}
              activeOpacity={0.7}
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
                  activeOpacity={0.7}
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
                activeOpacity={0.7}
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
        
        <View style={styles.confirmBlock}>
          <Text style={styles.confirmLabel}>Тип предприятия:</Text>
          <Text style={styles.confirmValue}>{selectedPlantType.plant_type_name}</Text>
          
          <Text style={styles.confirmLabel}>Место строительства:</Text>
          <Text style={styles.confirmValue}>{placeToShow?.region_name || 'Не выбрано'}</Text>
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
          activeOpacity={0.7}
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
            activeOpacity={0.7}
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

        {guildPlants.length > 0 && (
          <View style={styles.plantsListContainer}>
            <Text style={styles.sectionTitle}>Предприятия гильдии:</Text>
            <ScrollView style={styles.plantsListScroll}>
              {guildPlants.map((plant) => (
                <View key={plant.id} style={styles.plantItemContainer}>
                  <TouchableOpacity
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
                  <TouchableOpacity
                    style={styles.deleteButton}
                    activeOpacity={0.7}
                    onPress={() => handleDeletePlant(plant)}
                  >
                    <Text style={styles.deleteButtonIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
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

  const renderHeader = () => {
    // Для экрана подтверждения улучшения - показываем информацию о предприятии
    if (step === 'upgrade' && selectedPlantForUpgrade) {
      const plantInfo = `${selectedPlantForUpgrade.plant_level?.plant_type?.name} • Ур. ${selectedPlantForUpgrade.plant_level?.level} • ${selectedGuild?.name} • ID: ${selectedPlantForUpgrade.id}`;
      
      return (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
            <Text style={styles.headerBackButtonText}>Назад</Text>
          </TouchableOpacity>
          <View style={styles.headerCenterRow}>
            <Text style={styles.titleInline}>Улучшение:</Text>
            <Text style={styles.headerInfoInline}>{plantInfo}</Text>
          </View>
          <View style={styles.headerRight}>
            <ScannerStatusBadge style={styles.headerBadge} />
          </View>
        </View>
      );
    }
    
    // Для остальных экранов - показываем гильдию если выбрана
    if (selectedGuild && step !== 'guild') {
      return (
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
            <Text style={styles.headerBackButtonText}>Назад</Text>
          </TouchableOpacity>
          <View style={styles.headerCenterRow}>
            <Text style={styles.titleInline}>Предприятия:</Text>
            <Text style={styles.headerInfoInline}>{selectedGuild.name}</Text>
          </View>
          <View style={styles.headerRight}>
            <ScannerStatusBadge style={styles.headerBadge} />
          </View>
        </View>
      );
    }
    
    // Обычный заголовок для начального экрана
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBack}>
          <Text style={styles.headerBackButtonText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Предприятия</Text>
        <View style={styles.headerRight}>
          <ScannerStatusBadge style={styles.headerBadge} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}

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
    paddingTop: 20,
    backgroundColor: '#1976d2',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 52,
    justifyContent: 'flex-end',
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
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
  scanHintBlock: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  scanHintText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 60,
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
    alignSelf: 'center',
    maxWidth: 400,
    minWidth: 300,
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
    alignSelf: 'center',
    maxWidth: 400,
    minWidth: 300,
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
    alignSelf: 'center',
    maxWidth: 400,
    minWidth: 300,
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
  plantItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 50,
    minHeight: 60,
  },
  deleteButtonIcon: {
    fontSize: 24,
  },
});

export default PlantWorkshopScreen;
