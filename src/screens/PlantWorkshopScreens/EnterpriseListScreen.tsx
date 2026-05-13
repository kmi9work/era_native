import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { Alert } from 'react-native';
import PlantList from '../../screens/components/PlantList';
import { useEnterpriseManagement, EnterpriseData } from '../hooks/useEnterpriseManagement';

type RootStackParamList = {
  Settings: undefined;
  PlantWorkshop: undefined;
  Market: undefined;
};

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
 * Экран списка предприятий гильдии.
 * Отображает список предприятий с возможностью выбора, удаления и перехода к созданию нового.
 * Сканер обрабатывается на уровне PlantWorkshopScreen.
 */
export default function EnterpriseListScreen() {
  const navigation = useNavigation<NavigationProp<PlantWorkshopStackParamList>>();
  const route = useRoute<RouteProp<PlantWorkshopStackParamList, 'EnterpriseList'>>();
  const { guildId, guildName } = route.params as { guildId: number; guildName: string };

  const { state, loadGuildPlants, selectPlant, deletePlant } = useEnterpriseManagement();

  useEffect(() => {
    loadGuildPlants(guildId);
  }, [guildId, loadGuildPlants]);

  const handleSelectPlant = (plant: EnterpriseData) => {
    selectPlant(plant);
    navigation.navigate('UpgradeConfirm', { plantId: plant.id });
  };

  const handleDeletePlant = async (plant: EnterpriseData) => {
    Alert.alert(
      'Удаление предприятия',
      `Вы уверены, что хотите удалить "${plant.plant_level?.plant_type?.name}" (ID: ${plant.id})?\n\nЭто действие нельзя отменить.`,
      [
        { text: 'Отменить', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePlant(plant);
            if (success) {
              // Перезагружаем список
              loadGuildPlants(guildId);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Предприятия гильдии</Text>

      {state.loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      ) : (
        <PlantList
          plants={state.guildPlants}
          onSelectPlant={handleSelectPlant}
          onDeletePlant={handleDeletePlant}
          loading={false}
        />
      )}

      {/* Кнопка "Новое предприятие" */}
      <TouchableOpacity
        style={styles.scenarioButton}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('NewPlantType', { guildId, guildName })}
      >
        <Text style={styles.scenarioButtonIcon}>➕</Text>
        <View style={styles.scenarioButtonContent}>
          <Text style={styles.scenarioButtonText}>Новое предприятие</Text>
        </View>
      </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
  },
});
