import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { BarcodeScannerProvider } from './src/context/BarcodeScannerContext';

// Экраны — каждый в отдельном файле
import SettingsScreen from './src/screens/SettingsScreen';
import PlantWorkshopScreen from './src/screens/PlantWorkshopScreen';
import MarketScreen from './src/screens/MarketScreen';
import BattlesScreen from './src/screens/BattlesScreen';
import { initializePlugins } from './src/plugins';

// Игровые плагины регистрируют свои экраны в componentRegistry; ядро берёт их
// оттуда, если плагин активен (ACTIVE_GAME). Регистрация — до первой отрисовки.
initializePlugins();

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BarcodeScannerProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Settings"
            screenOptions={{
              headerShown: false, // Кастомные хедеры в каждом экране
              animation: 'slide_from_right',
              gestureEnabled: true,
              gestureDirection: 'horizontal',
            }}
          >
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen}
              options={{ title: 'Настройки' }}
            />
            <Stack.Screen 
              name="PlantWorkshop" 
              component={PlantWorkshopScreen}
              options={{ 
                presentation: 'modal', // Модальный переход для PlantWorkshop
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="Market"
              component={MarketScreen}
              options={{ title: 'Рынок' }}
            />
            <Stack.Screen
              name="Battles"
              component={BattlesScreen}
              options={{ title: 'Сражения' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </BarcodeScannerProvider>
    </GestureHandlerRootView>
  );
}
