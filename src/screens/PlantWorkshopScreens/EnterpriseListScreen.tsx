import React, { useCallback, useState } from 'react';
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
import DataFreshnessBadge from '../../components/DataFreshnessBadge';
import { queryKeys } from '../../data/keys';
import { useRefetchOnFocus } from '../../data/useRefetchOnFocus';
import { useGuilds } from '../../data';
import { Guild } from '../../types';

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
 * Данные — из слоя (ключ ['guild', id, 'plants']), обновляются при возврате на экран
 * и опросом 30 с, пока экран в фокусе; есть pull-to-refresh.
 */
export default function EnterpriseListScreen() {
  const navigation = useNavigation<NavigationProp<PlantWorkshopStackParamList>>();
  const route = useRoute<RouteProp<PlantWorkshopStackParamList, 'EnterpriseList'>>();
  const { guildId, guildName } = route.params as { guildId: number; guildName: string };

  // id гильдии уходит в хук: он и есть ключ слоя (['guild', id, 'plants']), на который экран
  // подписывается ниже через useRefetchOnFocus и показывает в шильдике свежести.
  const { state, loadGuildPlants, selectPlant, deletePlant } = useEnterpriseManagement(guildId);
  const [refreshing, setRefreshing] = useState(false);

  // Максимум предприятий у гильдии — из настроек игры (в /guilds.json приходят
  // plants_limit и plants_count). Правило мягкое: кнопка не блокируется, а
  // предупреждает, что сверх лимита строительство — только с согласования мастера.
  const guildsQuery = useGuilds();
  const guildInfo = ((guildsQuery.data as Guild[] | undefined) ?? []).find(item => item.id === guildId);
  const plantsLimit = guildInfo?.plants_limit ?? 0;
  // Пока список предприятий грузится — число из /guilds.json; после загрузки
  // считаем по фактическому списку (иначе после удаления всех предприятий
  // осталось бы предупреждение от устаревшего счётчика).
  const plantsCount = state.loading ? (guildInfo?.plants_count ?? 0) : state.guildPlants.length;
  const plantsLimitReached = plantsLimit > 0 && plantsCount >= plantsLimit;

  // Возврат на список (после улучшения, скана, создания) перечитывает предприятия гильдии.
  useRefetchOnFocus([queryKeys.guildPlants(guildId)]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGuildPlants(guildId);
    } finally {
      setRefreshing(false);
    }
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
          // Перезагрузку списка выполняет слой: мутация deletePlant инвалидирует ключи.
          onPress: () => {
            void deletePlant(plant);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.content}>
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
          refreshing={refreshing || state.refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* Кнопка "Новое предприятие" */}
      <TouchableOpacity
        style={[styles.scenarioButton, plantsLimitReached && styles.scenarioButtonAtLimit]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('NewPlantType', { guildId, guildName })}
      >
        <Text style={styles.scenarioButtonIcon}>➕</Text>
        <View style={styles.scenarioButtonContent}>
          <Text style={styles.scenarioButtonText}>Новое предприятие</Text>
          {plantsLimitReached && (
            <Text style={styles.scenarioButtonWarning}>
              Достигнут максимум предприятий ({plantsCount} из {plantsLimit}). Строительство —
              только с согласования мастера.
            </Text>
          )}
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
  scenarioButtonAtLimit: {
    backgroundColor: '#fff4e5',
    borderWidth: 2,
    borderColor: '#ef6c00',
  },
  scenarioButtonWarning: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#c62828',
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
  statusRow: {
    marginBottom: 10,
  },
});
