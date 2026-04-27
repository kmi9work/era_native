import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import PlantCostBlock from '../../screens/components/PlantCostBlock';
import ProcessingBlock from '../../screens/components/ProcessingBlock';
import { useUpgradeConfirmation } from '../hooks/useUpgradeConfirmation';

type PlantWorkshopStackParamList = {
  GuildSelection: undefined;
  EnterpriseList: { guildId: number; guildName: string };
  NewPlantType: undefined;
  PlantLocation: { plantTypeInfo: any };
  PlantConfirm: any;
  UpgradeConfirm: { plantId?: number; initialPlantData?: any };
};

/**
 * Экран подтверждения улучшения предприятия.
 * Отображает информацию о предприятии, стоимость улучшения,
 * блок переработки/добычи и кнопки действий.
 */
export default function UpgradeConfirmScreen() {
  const navigation = useNavigation<NavigationProp<PlantWorkshopStackParamList>>();
  const route = useRoute<RouteProp<PlantWorkshopStackParamList, 'UpgradeConfirm'>>();
  const { plantId, initialPlantData } = route.params as {
    plantId?: number;
    initialPlantData?: any;
  };

  const { state, processing, loadPlantForUpgrade, performUpgrade, reprintBarcode } =
    useUpgradeConfirmation();

  const loadedPlantIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (plantId && loadedPlantIdRef.current !== plantId) {
      loadedPlantIdRef.current = plantId;
      loadPlantForUpgrade(plantId);
    }
  }, [plantId]);

  const hasUpgradeCost =
    state.upgradeCost !== null && Object.keys(state.upgradeCost).length > 0;

  const handleUpgrade = async () => {
    const success = await performUpgrade();
    if (success) {
      // Возвращаемся к выбору гильдии
      navigation.goBack();
      navigation.goBack();
    }
  };

  const handleReprint = async () => {
    await reprintBarcode();
  };

  const { selectedPlantForUpgrade, isMaxLevel } = state;
  const selectedPlant = selectedPlantForUpgrade;
  const plantType = selectedPlant?.plant_level?.plant_type?.name || 'Предприятие';
  const plantLevel = selectedPlant?.plant_level?.level || '?';
  const guildName = selectedPlant?.economic_subject?.name || selectedPlant?.economic_subject || 'Гильдия';

  return (
    <View style={styles.content}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.stepTitle}>Улучшение предприятия</Text>

        {/* Информация о предприятии */}
        <View style={styles.plantInfoBlock}>
          <Text style={styles.plantInfoText}>
            {plantType} • Ур. {plantLevel} • {guildName} • ID: {selectedPlant?.id}
          </Text>
        </View>

        {/* Блок переработки/добычи */}
        <ProcessingBlock processing={processing} loading={false} />

        {/* Блок стоимости улучшения */}
        <PlantCostBlock
          cost={state.upgradeCost || {}}
          title="Стоимость улучшения:"
          isMaxLevel={isMaxLevel}
        />
      </ScrollView>

      {/* Кнопки действий — фиксированные внизу */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.primaryButton, !hasUpgradeCost && styles.primaryButtonDisabled]}
          activeOpacity={0.7}
          onPress={handleUpgrade}
          disabled={!hasUpgradeCost}
        >
          <Text style={styles.primaryButtonText}>
            {isMaxLevel ? 'Макс.' : 'Улучшить'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, styles.secondaryButton]}
          activeOpacity={0.7}
          onPress={handleReprint}
        >
          <Text style={styles.secondaryButtonText}>Напечатать штрихкод</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 20,
    paddingBottom: 10,
  },
  scrollContent: {
    flexGrow: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
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
  plantInfoText: {
    fontSize: 14,
    color: '#666',
  },
  actionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 20,
  },
  primaryButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  primaryButtonDisabled: {
    backgroundColor: '#bdbdbd',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
  },
});
