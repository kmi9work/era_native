import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { usePlantBuilding } from '../hooks/usePlantBuilding';

type PlantWorkshopStackParamList = {
  GuildSelection: undefined;
  EnterpriseList: { guildId: number; guildName: string };
  NewPlantType: { guildId: number; guildName: string };
  PlantLocation: { plantTypeInfo: any; guildId: number; guildName: string; firstLevel: any };
  PlantConfirm: {
    plantTypeInfo: any;
    place: any;
    firstLevel: any;
    guildId: number;
    guildName: string;
  };
  UpgradeConfirm: { plantId?: number; initialPlantData?: any };
};

/**
 * Экран выбора типа нового предприятия.
 * Отображает список доступных типов с фильтрацией по категориям.
 */
export default function NewPlantTypeScreen() {
  const navigation = useNavigation<NavigationProp<PlantWorkshopStackParamList>>();
  const route = useRoute<RouteProp<PlantWorkshopStackParamList, 'NewPlantType'>>();
  const { guildId, guildName } = route.params as { guildId: number; guildName: string };

  const {
    state,
    filterCategoryId,
    setFilterCategoryId,
    plantCategories,
    getFilteredPlantTypes,
    loadAvailablePlaces,
    selectPlantType,
  } = usePlantBuilding();

  useEffect(() => {
    loadAvailablePlaces();
  }, [loadAvailablePlaces]);

  const filteredPlants = getFilteredPlantTypes();

  const getClosedTechnologyNames = (info: any): string[] => {
    return (info?.technology_requirements || [])
      .filter((req: any) => !req.open)
      .map((req: any) => `«${req.name}»`);
  };

  const handleSelectPlantType = async (plantType: any) => {
    const firstLevel = await selectPlantType(plantType);
    console.log('[DEBUG] NewPlantTypeScreen: selectPlantType returned firstLevel=', firstLevel);
    console.log('[DEBUG] NewPlantTypeScreen: navigating to PlantLocation with firstLevel=', JSON.stringify(firstLevel));
    navigation.navigate('PlantLocation', {
      plantTypeInfo: plantType,
      guildId,
      guildName,
      firstLevel,
    });
  };

  return (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Выберите тип предприятия</Text>

      {/* Фильтры по категориям */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filterCategoryId === null && styles.filterButtonActive]}
          activeOpacity={0.7}
          onPress={() => setFilterCategoryId(null)}
        >
          <Text style={[styles.filterButtonText, filterCategoryId === null && styles.filterButtonTextActive]}>
            Все
          </Text>
        </TouchableOpacity>
        {plantCategories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.filterButton, filterCategoryId === cat.id && styles.filterButtonActive]}
            activeOpacity={0.7}
            onPress={() => setFilterCategoryId(cat.id)}
          >
            <Text style={[styles.filterButtonText, filterCategoryId === cat.id && styles.filterButtonTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {state.loading ? (
        <ActivityIndicator size="large" color="#1976d2" />
      ) : (
        <ScrollView style={styles.plantTypesList}>
          {filteredPlants.map((plantType) => {
            const closedTechnologyNames = getClosedTechnologyNames(plantType);
            const hasAnyPlaces = plantType.available_places.length > 0;
            const hasAllowedPlaces = plantType.available_places.some(
              (place: any) => place.allowed !== false
            );

            return (
              <TouchableOpacity
                key={plantType.plant_type_id}
                style={[
                  styles.itemButton,
                  !hasAnyPlaces && styles.itemButtonDisabled,
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelectPlantType(plantType)}
                disabled={!hasAnyPlaces}
              >
                <View style={styles.itemButtonContent}>
                  <Text
                    style={[
                      styles.itemButtonText,
                      !hasAnyPlaces && styles.itemButtonTextDisabled,
                    ]}
                  >
                    {plantType.plant_type_name}
                  </Text>
                  {!hasAnyPlaces && (
                    <Text style={styles.forbiddenNotice}>
                      Нет свободных площадок — строительство временно недоступно
                    </Text>
                  )}
                  {hasAnyPlaces && !hasAllowedPlaces && (
                    <Text style={styles.forbiddenNotice}>
                      Нет площадок в землях Руси — строительство запрещено правилами
                    </Text>
                  )}
                  {closedTechnologyNames.length > 0 && (
                    <Text style={styles.forbiddenNotice}>
                      Технология {closedTechnologyNames.join(', ')} не открыта — строительство запрещено правилами
                    </Text>
                  )}
                </View>
                <Text style={styles.itemButtonArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 10,
    minHeight: 60,
  },
  itemButtonDisabled: {
    opacity: 0.4,
  },
  itemButtonContent: {
    flex: 1,
  },
  itemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemButtonTextDisabled: {
    color: '#999',
  },
  itemButtonArrow: {
    fontSize: 24,
    color: '#999',
  },
  forbiddenNotice: {
    marginTop: 6,
    color: '#d32f2f',
    fontSize: 13,
    fontWeight: '600',
  },
});
