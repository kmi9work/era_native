import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import {
  createStackNavigator,
  StackHeaderProps,
} from '@react-navigation/stack';
import {
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
import ScannerStatusBadge from '../components/ScannerStatusBadge';
import { useBarcodeScannerContext } from '../context/BarcodeScannerContext';
import ApiService from '../services/api';
import { CONFIG } from '../config';
import { MultiEnterpriseProvider, useMultiEnterprise, useMultiEnterpriseLogic } from './PlantWorkshopScreens/multiEnterpriseContext';

// Внутренние экраны
import GuildSelectionScreen from './PlantWorkshopScreens/GuildSelectionScreen';
import EnterpriseListScreen from './PlantWorkshopScreens/EnterpriseListScreen';
import NewPlantTypeScreen from './PlantWorkshopScreens/NewPlantTypeScreen';
import PlantLocationScreen from './PlantWorkshopScreens/PlantLocationScreen';
import PlantConfirmScreen from './PlantWorkshopScreens/PlantConfirmScreen';
import UpgradeConfirmScreen from './PlantWorkshopScreens/UpgradeConfirmScreen';
import MultiEnterprisesScreen from './PlantWorkshopScreens/MultiEnterprisesScreen';

// ========================
// Типы
// ========================

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
  MultiEnterprises: undefined;
};

const Stack = createStackNavigator<PlantWorkshopStackParamList>();

// ========================
// Кастомный хедер
// ========================

function PlantWorkshopHeader({ navigation, options }: StackHeaderProps) {
  const { entries } = useMultiEnterprise();

  const handleOpenMultiEnterprises = useCallback(() => {
    (navigation as any).navigate('MultiEnterprises');
  }, [navigation]);

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerBackButton}
        activeOpacity={0.7}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.headerBackButtonText}>Назад</Text>
      </TouchableOpacity>
      <View style={styles.headerCenterColumn}>
        <Text style={styles.headerTitle}>
          {(options as any)?.title || 'Предприятия'}
        </Text>
        <TouchableOpacity
          style={styles.multiButton}
          activeOpacity={0.7}
          onPress={handleOpenMultiEnterprises}
        >
          <Text style={styles.multiButtonText}>Много предприятий ({entries.length})</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerRight}>
        <ScannerStatusBadge style={styles.headerBadge} />
      </View>
    </View>
  );
}

// ========================
// Хелпер для обработки данных предприятия
// ========================

const processPlantForMultiEnterprise = (plantData: any) => {
  const isExtractive = plantData?.plant_level?.plant_type?.plant_category?.is_extractive || false;
  const plantType = plantData.plant_level?.plant_type;
  
  const formulaFrom: any[] = [];
  const formulaTo: any[] = [];
  
  if (!isExtractive && plantData.plant_level?.formulas) {
    const formulas = plantData.plant_level.formulas;
    const seenFrom = new Set<string>();
    const seenTo = new Set<string>();
    
    for (const f of formulas) {
      for (const item of (f.from || [])) {
        if (!seenFrom.has(item.identificator)) {
          seenFrom.add(item.identificator);
          formulaFrom.push(item);
        }
      }
      for (const item of (f.to || [])) {
        if (!seenTo.has(item.identificator)) {
          seenTo.add(item.identificator);
          formulaTo.push(item);
        }
      }
    }
  } else if (isExtractive) {
    const seenTo = new Set<string>();
    const formulas = plantData.plant_level?.formulas || [];
    for (const f of formulas) {
      for (const item of (f.to || [])) {
        if (!seenTo.has(item.identificator)) {
          seenTo.add(item.identificator);
          formulaTo.push(item);
        }
      }
    }
  }

  const configuredBase = (CONFIG.BACKEND_URL || '').replace(/\/+$/, '').replace(/\/backend$/i, '');
  const baseURL = configuredBase || (ApiService['api']?.defaults?.baseURL || 'http://192.168.1.101:3000');
  formulaFrom.forEach((item: any) => {
    item.imageUrl = `${baseURL}/images/resources/${item.identificator}.png`;
  });
  formulaTo.forEach((item: any) => {
    item.imageUrl = `${baseURL}/images/resources/${item.identificator}.png`;
  });

  const economicSubject = plantData.economic_subject || plantData.economic_subject_id || null;
  
  return {
    plantId: plantData.id,
    plant: plantData,
    guild: economicSubject,
    isExtractive,
    formulaFrom,
    formulaTo,
    inputFrom: {},
    resultFrom: [],
    resultTo: [],
    resultChange: [],
    fullPlantLevel: plantData.plant_level,
  };
};

// ========================
// Корневой Stack
// ========================

function PlantWorkshopStackInner() {
  const { addListener } = useBarcodeScannerContext();
  // navigation here is the ROOT navigator (Settings, PlantWorkshop, Market)
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {
    entries,
    totals,
    isLoading,
    resources,
    addEntry,
    removeEntry,
    clearEntries,
    setEntryInputFromValue,
    calculateFrom,
    setLoading,
  } = useMultiEnterpriseLogic();

  const lastHandledBarcodeRef = useRef<string | null>(null);

  const handleBarcodeScanned = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || lastHandledBarcodeRef.current === trimmed) {
      return;
    }
    lastHandledBarcodeRef.current = trimmed;
    setTimeout(() => {
      lastHandledBarcodeRef.current = null;
    }, 500);

    const enterpriseId = parseInt(trimmed, 10);
    if (Number.isNaN(enterpriseId)) {
      return;
    }

    setLoading(true);
    try {
      const plantData = await ApiService.getPlant(enterpriseId);
      
      if (!plantData) {
        Alert.alert('Ошибка', 'Предприятие не найдено');
        setLoading(false);
        return;
      }

      if (!plantData.plant_level) {
        Alert.alert('Ошибка', 'У предприятия нет уровня');
        setLoading(false);
        return;
      }

      // Check the current inner screen via the root navigator's state
      const rootState = navigation.getState();
      const plantWorkshopRoute = rootState.routes.find(r => r.name === 'PlantWorkshop');
      const innerState = plantWorkshopRoute?.state;
      const currentInnerRoute = innerState?.routes?.[innerState.index ?? 0]?.name;
      const isOnMultiScreen = currentInnerRoute === 'MultiEnterprises';

      if (isOnMultiScreen) {
        // On MultiEnterprises screen: add to the multi-enterprise list
        const entry = processPlantForMultiEnterprise(plantData);
        addEntry(entry);
      } else {
        // On any other screen: use nested navigation syntax
        // This tells the root navigator to navigate to PlantWorkshop,
        // then to UpgradeConfirm inside the inner stack
        (navigation as any).navigate('PlantWorkshop', {
          screen: 'UpgradeConfirm',
          params: { plantId: plantData.id },
        });
      }
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось загрузить предприятие');
    } finally {
      setLoading(false);
    }
  }, [addEntry, setLoading, navigation]);

  // Scanner listener - handles scans on all screens
  useEffect(() => {
    const unsubscribe = addListener('plantWorkshop', (code) => {
      handleBarcodeScanned(code);
    });
    return () => {
      unsubscribe();
    };
  }, [addListener]);

  const commonScreenOptions = {
    header: PlantWorkshopHeader,
  };

  return (
    <MultiEnterpriseProvider value={{
      entries,
      totals,
      isLoading,
      resources,
      addEntry,
      removeEntry,
      clearEntries,
      setEntryInputFromValue,
      calculateFrom,
      setLoading,
    }}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#1976d2' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
        }}
      >
        <Stack.Screen
          name="GuildSelection"
          component={GuildSelectionScreen}
          options={{
            ...commonScreenOptions,
            title: 'Выбор гильдии',
          }}
        />
        <Stack.Screen
          name="EnterpriseList"
          component={EnterpriseListScreen}
          options={{
            ...commonScreenOptions,
            title: 'Предприятия гильдии',
          }}
        />
        <Stack.Screen
          name="NewPlantType"
          component={NewPlantTypeScreen}
          options={{
            ...commonScreenOptions,
            title: 'Новое предприятие',
          }}
        />
        <Stack.Screen
          name="PlantLocation"
          component={PlantLocationScreen}
          options={{
            ...commonScreenOptions,
            title: 'Выбор места',
          }}
        />
        <Stack.Screen
          name="PlantConfirm"
          component={PlantConfirmScreen}
          options={{
            ...commonScreenOptions,
            title: 'Подтверждение строительства',
          }}
        />
        <Stack.Screen
          name="UpgradeConfirm"
          component={UpgradeConfirmScreen}
          options={{
            ...commonScreenOptions,
            title: 'Улучшение предприятия',
          }}
        />
        <Stack.Screen
          name="MultiEnterprises"
          component={MultiEnterprisesScreen}
          options={{
            ...commonScreenOptions,
            title: 'Много предприятий',
          }}
        />
      </Stack.Navigator>
    </MultiEnterpriseProvider>
  );
}

// ========================
// Экспорт
// ========================

export default function PlantWorkshopScreen() {
  return <PlantWorkshopStackInner />;
}

// ========================
// Стили
// ========================

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingTop: 20,
    backgroundColor: '#1976d2',
  },
  headerCenterColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  multiButton: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  multiButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
});
