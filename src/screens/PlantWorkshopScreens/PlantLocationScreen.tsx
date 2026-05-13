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
import ResourceItem from '../../screens/ResourceItem';
import PlantCostBlock from '../../screens/components/PlantCostBlock';
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
 * Экран выбора места строительства.
 * Отображает доступные места для выбранного типа предприятия.
 */
export default function PlantLocationScreen() {
  const navigation = useNavigation<NavigationProp<PlantWorkshopStackParamList>>();
  const route = useRoute<RouteProp<PlantWorkshopStackParamList, 'PlantLocation'>>();
  const { plantTypeInfo, guildId, guildName, firstLevel: incomingFirstLevel } = route.params as {
    plantTypeInfo: any;
    guildId: number;
    guildName: string;
    firstLevel: any;
  };

  const { state, selectPlace } = usePlantBuilding();

  useEffect(() => {
    // Устанавливаем выбранный тип предприятия
  }, [plantTypeInfo]);

  const handleSelectPlace = (place: any) => {
    selectPlace(place);
    const firstLevelToPass = incomingFirstLevel || state.firstLevel;
    console.log('[DEBUG] PlantLocationScreen: incomingFirstLevel=', incomingFirstLevel);
    console.log('[DEBUG] PlantLocationScreen: state.firstLevel=', state.firstLevel);
    console.log('[DEBUG] PlantLocationScreen: firstLevelToPass=', firstLevelToPass);
    // Переходим к подтверждению — используем firstLevel из params, если он есть
    navigation.navigate('PlantConfirm', {
      plantTypeInfo,
      place,
      firstLevel: firstLevelToPass,
      guildId,
      guildName,
    });
  };

  const closedTechnologyNames = (plantTypeInfo?.technology_requirements || [])
    .filter((req: any) => !req.open)
    .map((req: any) => `«${req.name}»`);

  return (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>{plantTypeInfo?.plant_type_name}</Text>

      {closedTechnologyNames.length > 0 && (
        <Text style={styles.forbiddenNotice}>
          Технология {closedTechnologyNames.join(', ')} не открыта — строительство запрещено правилами.
          Продолжайте только по решению ведущего.
        </Text>
      )}

      <PlantCostBlock
        cost={(incomingFirstLevel || state.firstLevel)?.price || {}}
        title="Стоимость строительства:"
      />

      <Text style={styles.sectionTitle}>Выберите место строительства:</Text>

      {state.loading ? (
        <ActivityIndicator size="large" color="#1976d2" />
      ) : (
        <ScrollView style={styles.placesList}>
          {plantTypeInfo?.available_places?.map((place: any) => (
            <TouchableOpacity
              key={place.id}
              style={styles.itemButton}
              activeOpacity={0.7}
              onPress={() => handleSelectPlace(place)}
            >
              <View style={styles.itemButtonContent}>
                <Text style={styles.itemButtonText}>{place.region_name}</Text>
                {place.allowed === false && (
                  <Text style={styles.forbiddenNotice}>
                    Регион не принадлежит Руси — строительство запрещено правилами
                  </Text>
                )}
              </View>
              <Text style={styles.itemButtonArrow}>›</Text>
            </TouchableOpacity>
          ))}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  costBlock: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  costTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 10,
  },
  placesList: {
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
  itemButtonContent: {
    flex: 1,
  },
  itemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
