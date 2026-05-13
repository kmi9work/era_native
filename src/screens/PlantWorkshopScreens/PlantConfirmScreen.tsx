import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { Alert as AlertLib } from 'react-native';
import { BrotherPrinterService } from '../../services/BrotherPrinterService';
import ApiService from '../../services/api';
import PlantCostBlock from '../../screens/components/PlantCostBlock';
import { gameConfig } from '../../config/game';

type PlantWorkshopStackParamList = {
  GuildSelection: undefined;
  EnterpriseList: { guildId: number; guildName: string };
  NewPlantType: undefined;
  PlantLocation: { plantTypeInfo: any };
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
 * Экран подтверждения строительства.
 * Отображает информацию о строительстве и кнопку подтверждения.
 */
export default function PlantConfirmScreen() {
  const navigation = useNavigation<NavigationProp<PlantWorkshopStackParamList>>();
  const route = useRoute<RouteProp<PlantWorkshopStackParamList, 'PlantConfirm'>>();
  const { plantTypeInfo, place, firstLevel, guildId, guildName } = route.params as {
    plantTypeInfo: any;
    place: any;
    firstLevel: any;
    guildId: number;
    guildName: string;
  };
  console.log('[DEBUG] PlantConfirmScreen: route.params keys=', Object.keys(route.params));
  console.log('[DEBUG] PlantConfirmScreen: firstLevel=', firstLevel);
  console.log('[DEBUG] PlantConfirmScreen: firstLevel type=', typeof firstLevel);

  const [loading, setLoading] = useState(false);
  const isGameArtel = gameConfig.isActive('artel');

  const handleBuildPlant = async () => {
    if (!place) {
      Alert.alert('Ошибка', 'Не все данные заполнены');
      return;
    }

    setLoading(true);
    let createdPlant: any = null;

    try {
      createdPlant = await ApiService.createPlant({
        plant_level_id: firstLevel.id,
        plant_place_id: place.id ?? null,
        economic_subject: `${guildId}_Guild`,
      });

      let plantData = createdPlant;
      if (createdPlant && createdPlant.plant) {
        plantData = createdPlant.plant;
      } else if (createdPlant && createdPlant.data) {
        plantData = createdPlant.data;
      }

      if (!plantData || typeof plantData.id === 'undefined') {
        throw new Error('Не удалось получить ID созданного предприятия');
      }

      const regionName = place.name || 'Неизвестный регион';

      const printResult = await BrotherPrinterService.printBarcode(plantData.id, guildName, regionName);

      if (printResult.success) {
        Alert.alert(
          'Успех',
          `Предприятие успешно построено!\nID: ${plantData.id}\nШтрихкод напечатан.`,
          [
            {
              text: 'ОК',
              onPress: () => {
                navigation.goBack();
                navigation.goBack();
              },
            },
            {
              text: 'Напечатать заново',
              onPress: () => {
                BrotherPrinterService.printBarcode(plantData.id, guildName, regionName);
                navigation.goBack();
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        if (!printResult.error || !printResult.error.includes('OpenStreamFailure')) {
          Alert.alert('Ошибка', printResult.error);
        }

        Alert.alert(
          'Ошибка печати',
          `Не удалось напечатать штрихкод: ${printResult.error}\n\nХотите всё равно создать предприятие без печати?`,
          [
            {
              text: 'Отменить',
              style: 'cancel',
              onPress: async () => {
                try {
                  await ApiService.deletePlant(plantData.id);
                } catch (deleteError: any) {
                  // ignore
                }
              },
            },
            {
              text: 'Всё равно создать',
              onPress: () => {
                Alert.alert('Успех', `Предприятие создано!\nID: ${plantData.id}\n\nШтрихкод не был напечатан.`);
                navigation.goBack();
                navigation.goBack();
              },
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось создать предприятие');
      setLoading(false);
    }
  };

  const closedTechnologyNames = (plantTypeInfo?.technology_requirements || [])
    .filter((req: any) => !req.open)
    .map((req: any) => `«${req.name}»`);

  return (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Подтверждение строительства</Text>

      <View style={styles.confirmBlock}>
        <Text style={styles.confirmLabel}>Тип предприятия:</Text>
        <Text style={styles.confirmValue}>{plantTypeInfo?.plant_type_name}</Text>

        <Text style={styles.confirmLabel}>Место строительства:</Text>
        <Text style={styles.confirmValue}>{place?.region_name || 'Не выбрано'}</Text>
      </View>

      {closedTechnologyNames.length > 0 && (
        <Text style={styles.forbiddenNotice}>
          Технология {closedTechnologyNames.join(', ')} не открыта — строительство запрещено правилами.
        </Text>
      )}

      {place && place.allowed === false && (
        <Text style={styles.forbiddenNotice}>
          Регион не принадлежит Руси — строительство запрещено правилами.
        </Text>
      )}

      <PlantCostBlock
        cost={firstLevel?.price || {}}
      />

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
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
  forbiddenNotice: {
    marginBottom: 15,
    color: '#d32f2f',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  primaryButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
});
