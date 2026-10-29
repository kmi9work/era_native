import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import PlantCostBlock from '../../screens/components/PlantCostBlock';
import ProcessingBlock from '../../screens/components/ProcessingBlock';
import { useUpgradeConfirmation } from '../hooks/useUpgradeConfirmation';
import DataFreshnessBadge from '../../components/DataFreshnessBadge';
import { queryKeys } from '../../data/keys';
import { componentRegistry } from '../../registry';
import { useRefetchOnFocus } from '../../data/useRefetchOnFocus';

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
 * Данные предприятия (ключ ['plant', id], TTL 0) и справочник уровней приходят из слоя:
 * refetch-on-focus, фоновое обновление не перерисовывает введённые значения.
 */
export default function UpgradeConfirmScreen() {
  const navigation = useNavigation<NavigationProp<PlantWorkshopStackParamList>>();
  const route = useRoute<RouteProp<PlantWorkshopStackParamList, 'UpgradeConfirm'>>();
  const { plantId } = route.params as {
    plantId?: number;
    initialPlantData?: any;
  };

  const {
    state,
    processing,
    loadPlantForUpgrade,
    performUpgrade,
    performDowngrade,
    reprintBarcode,
    plantCountryId,
    plantCountryName,
    isUpgradeForbidden,
    ruralSchoolsTechnologyName,
  } = useUpgradeConfirmation();

  const loadedPlantIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (plantId && loadedPlantIdRef.current !== plantId) {
      loadedPlantIdRef.current = plantId;
      loadPlantForUpgrade(plantId);
    }
  }, [plantId, loadPlantForUpgrade]);

  // Возврат на экран улучшения (после работы с цехом, скана) перечитывает предприятие и справочники.
  // Технологии — государства ЗЕМЕЛЬ предприятия (правило «Сельские школы»).
  useRefetchOnFocus([
    plantId != null ? queryKeys.plant(plantId) : null,
    queryKeys.plantLevels(),
    queryKeys.resources(),
    // Технологии — для плашки «Технические училища открыты» в блоке переработки.
    queryKeys.technologies(),
    plantCountryId != null ? queryKeys.technologiesForCountry(plantCountryId) : null,
  ]);

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

  /**
   * «Сельские школы» не открыты в государстве земель предприятия: улучшение
   * запрещено правилами, но решение за мастером — поэтому предупреждение с
   * третьей кнопкой «Всё равно улучшить», а не заблокированная кнопка.
   */
  const handleUpgradePress = () => {
    if (!isUpgradeForbidden) {
      void handleUpgrade();
      return;
    }

    const where = plantCountryName ? ` в государстве «${plantCountryName}»` : '';
    Alert.alert(
      'Улучшение запрещено',
      `Улучшение предприятия запрещено:${where} не открыта технология «${ruralSchoolsTechnologyName}».\n\n` +
        'Мастер может улучшить предприятие в обход правила.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Всё равно улучшить',
          style: 'destructive',
          onPress: () => {
            void handleUpgrade();
          },
        },
      ],
    );
  };

  const handleReprint = async () => {
    await reprintBarcode();
  };

  const handleDowngrade = async () => {
    await performDowngrade();
  };

  const { selectedPlantForUpgrade, isMaxLevel } = state;
  const selectedPlant = selectedPlantForUpgrade;
  const plantType = selectedPlant?.plant_level?.plant_type?.name || 'Предприятие';
  const plantLevel = selectedPlant?.plant_level?.level || '?';
  const plantLevelNum = selectedPlant?.plant_level?.level;
  const canDowngrade = typeof plantLevelNum === 'number' && plantLevelNum > 1;
  const guildName = selectedPlant?.economic_subject?.name || selectedPlant?.economic_subject || 'Гильдия';

  // Запрет строительства и работы предприятий (п. 0-5) — точка расширения
  // игрового плагина: в many_teams компонент знает разрешение гильдии в
  // государстве, где стоит предприятие, и рисует плашку. В базовой игре
  // компонент не зарегистрирован — экран не меняется.
  const PlantWorkNotice = componentRegistry.get<{ plant: any }>('many_teams.PlantWorkNotice');

  return (
    <View style={styles.content}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.stepTitle}>Улучшение предприятия</Text>

        <View style={styles.statusRow}>
          <DataFreshnessBadge
            keys={[plantId != null ? queryKeys.plant(plantId) : null, queryKeys.plantLevels()]}
          />
        </View>

        {/* Информация о предприятии */}
        <View style={styles.plantInfoBlock}>
          <Text style={styles.plantInfoText}>
            {plantType} • Ур. {plantLevel} • {guildName} • ID: {selectedPlant?.id}
          </Text>
        </View>

        {PlantWorkNotice && selectedPlant ? <PlantWorkNotice plant={selectedPlant} /> : null}

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
        <View style={styles.row}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              styles.halfButton,
              !hasUpgradeCost && styles.primaryButtonDisabled,
              // «Сельские школы» закрыты — кнопка предупреждает, но нажимается.
              hasUpgradeCost && isUpgradeForbidden && styles.primaryButtonForbidden,
            ]}
            activeOpacity={0.7}
            onPress={handleUpgradePress}
            disabled={!hasUpgradeCost}
          >
            <Text
              style={[
                styles.primaryButtonText,
                hasUpgradeCost && isUpgradeForbidden && styles.primaryButtonForbiddenText,
              ]}
            >
              {isMaxLevel ? 'Макс.' : isUpgradeForbidden ? 'Запрещено' : 'Улучшить'}
            </Text>
          </TouchableOpacity>

          {canDowngrade && (
            <TouchableOpacity
              style={[styles.primaryButton, styles.halfButton, styles.downgradeButton]}
              activeOpacity={0.7}
              onPress={handleDowngrade}
            >
              <Text style={styles.primaryButtonText}>Уменьшить уровень</Text>
            </TouchableOpacity>
          )}
        </View>

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
  statusRow: {
    marginBottom: 10,
  },
  actionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfButton: {
    flex: 1,
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
  /**
   * «Запрещено» (не открыта технология «Сельские школы»): светлый красный фон и
   * красная надпись. Кнопка остаётся нажимаемой — мастер может обойти правило.
   */
  primaryButtonForbidden: {
    backgroundColor: '#ffebee',
    borderWidth: 2,
    borderColor: '#c62828',
  },
  primaryButtonForbiddenText: {
    color: '#c62828',
  },
  downgradeButton: {
    backgroundColor: '#e65100',
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
