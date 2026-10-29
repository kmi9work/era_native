import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useBarcodeScannerContext } from '../../context/BarcodeScannerContext';
import { useGuildManagement } from '../hooks/useGuildManagement';
import DataFreshnessBadge from '../../components/DataFreshnessBadge';
import { queryKeys } from '../../data/keys';
import { useRefetchOnFocus } from '../../data/useRefetchOnFocus';
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
 * Экран выбора гильдии.
 * Отображает список гильдий для выбора.
 * Также регистрирует listener для сканирования штрихкодов.
 */
export default function GuildSelectionScreen() {
  const navigation = useNavigation<NavigationProp<PlantWorkshopStackParamList>>();
  const { state, loadGuilds, selectGuild } = useGuildManagement();
  const { addListener } = useBarcodeScannerContext();
  const lastHandledBarcodeRef = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Возврат на этот экран (из списка предприятий, из штрихкод-флоу) обновляет список гильдий.
  useRefetchOnFocus([queryKeys.guilds()]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGuilds();
    } finally {
      setRefreshing(false);
    }
  }, [loadGuilds]);

  // Регистрируем listener для сканирования штрихкодов
  useEffect(() => {
    console.log('[GuildSelectionScreen] Registering barcode listener');
    const unsubscribe = addListener('plantWorkshop', (code) => {
      console.log('[GuildSelectionScreen] Barcode received:', code);
      if (!code.trim()) return;
      if (lastHandledBarcodeRef.current === code) return;
      lastHandledBarcodeRef.current = code;

      const enterpriseId = parseInt(code);
      if (!isNaN(enterpriseId)) {
        navigation.navigate('UpgradeConfirm', { plantId: enterpriseId });
      }

      setTimeout(() => {
        if (lastHandledBarcodeRef.current === code) {
          lastHandledBarcodeRef.current = null;
        }
      }, 500);
    });

    return () => {
      console.log('[GuildSelectionScreen] Unregister barcode listener');
      unsubscribe();
      lastHandledBarcodeRef.current = null;
    };
  }, [addListener, navigation]);

  const handleSelectGuild = (guild: any) => {
    selectGuild(guild);
    navigation.navigate('EnterpriseList', {
      guildId: guild.id,
      guildName: guild.name,
    });
  };

  // Предприятия гильдии: сколько построено и максимум из настроек игры.
  // Максимум 0/отсутствует — лимит не задан, показываем только число.
  const plantsCount = (guild: Guild) => guild.plants_count ?? guild.plants?.length ?? 0;
  const plantsLimit = (guild: Guild) => guild.plants_limit ?? 0;
  const atPlantsLimit = (guild: Guild) => {
    const limit = plantsLimit(guild);
    return limit > 0 && plantsCount(guild) >= limit;
  };
  const plantsLabel = (guild: Guild) => {
    const limit = plantsLimit(guild);
    return limit > 0
      ? `Предприятий: ${plantsCount(guild)} из ${limit}`
      : `Предприятий: ${plantsCount(guild)}`;
  };

  return (
    <View style={styles.content}>
      <Text style={styles.stepTitle}>Выберите гильдию</Text>
      <Text style={styles.stepSubtitle}>
        Или отсканируйте штрихкод для быстрого перехода к переработке
      </Text>

      <View style={styles.scanHintBlock}>
        <Text style={styles.scanHintText}>
          Сканер всегда активен. Отсканируйте штрихкод предприятия, и система сразу перейдёт к экрану
          улучшения с кнопкой «Улучшить».
        </Text>
      </View>

      <View style={styles.statusRow}>
        <DataFreshnessBadge keys={[queryKeys.guilds()]} />
      </View>

      {state.loading ? (
        <ActivityIndicator size="large" color="#1976d2" />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {state.guilds.length === 0 && (
            <Text style={styles.emptyText}>
              {state.isOffline
                ? 'Нет связи с сервером. Показаны последние полученные данные (их нет).'
                : 'Список гильдий пуст.'}
            </Text>
          )}
          {state.guilds.map((guild) => (
            <TouchableOpacity
              key={guild.id}
              style={styles.itemButton}
              activeOpacity={0.7}
              onPress={() => handleSelectGuild(guild)}
            >
              <View style={styles.itemButtonContent}>
                <Text style={styles.itemButtonText}>{guild.name}</Text>
                <Text
                  style={[styles.itemButtonMeta, atPlantsLimit(guild) && styles.itemButtonMetaWarning]}
                >
                  {plantsLabel(guild)}{atPlantsLimit(guild) ? ' — максимум' : ''}
                </Text>
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
  itemButtonMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
  },
  itemButtonMetaWarning: {
    color: '#c62828',
    fontWeight: '700',
  },
  itemButtonArrow: {
    fontSize: 24,
    color: '#999',
  },
  statusRow: {
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    paddingVertical: 12,
  },
});
