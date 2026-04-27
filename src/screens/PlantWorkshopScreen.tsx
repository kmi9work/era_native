import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  createStackNavigator,
  StackHeaderProps,
} from '@react-navigation/stack';
import {
  useNavigation,
  NavigationProp,
} from '@react-navigation/native';
import ScannerStatusBadge from '../components/ScannerStatusBadge';

// Внутренние экраны
import GuildSelectionScreen from './PlantWorkshopScreens/GuildSelectionScreen';
import EnterpriseListScreen from './PlantWorkshopScreens/EnterpriseListScreen';
import NewPlantTypeScreen from './PlantWorkshopScreens/NewPlantTypeScreen';
import PlantLocationScreen from './PlantWorkshopScreens/PlantLocationScreen';
import PlantConfirmScreen from './PlantWorkshopScreens/PlantConfirmScreen';
import UpgradeConfirmScreen from './PlantWorkshopScreens/UpgradeConfirmScreen';

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
  PlantLocation: { plantTypeInfo: any; guildId: number; guildName: string };
  PlantConfirm: {
    plantTypeInfo: any;
    place: any;
    firstLevel: any;
    guildId: number;
    guildName: string;
  };
  UpgradeConfirm: { plantId?: number; initialPlantData?: any };
};

const Stack = createStackNavigator<PlantWorkshopStackParamList>();

// ========================
// Кастомный хедер
// ========================

function PlantWorkshopHeader({ navigation, options }: StackHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerBackButton}
        activeOpacity={0.7}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.headerBackButtonText}>Назад</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {(options as any)?.title || 'Предприятия'}
      </Text>
      <View style={styles.headerRight}>
        <ScannerStatusBadge style={styles.headerBadge} />
      </View>
    </View>
  );
}

// ========================
// Корневой Stack
// ========================

function PlantWorkshopStack() {
  const commonScreenOptions = {
    header: PlantWorkshopHeader,
  };

  return (
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
    </Stack.Navigator>
  );
}

// ========================
// Экспорт
// ========================

export default function PlantWorkshopScreen() {
  return <PlantWorkshopStack />;
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
});
