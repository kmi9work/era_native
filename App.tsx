import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { BarcodeScannerProvider } from './src/context/BarcodeScannerContext';

// Экраны — каждый в отдельном файле
import SettingsScreen from './src/screens/SettingsScreen';
import PlantWorkshopScreen from './src/screens/PlantWorkshopScreen';
import MarketScreen from './src/screens/MarketScreen';

const Stack = createStackNavigator();

// Типы для route params
type RootStackParamList = {
  Settings: undefined;
  PlantWorkshop: { initialStep?: 'guild' | 'enterprise' | 'newPlant' | 'upgrade' };
  Market: undefined;
};

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
          </Stack.Navigator>
        </NavigationContainer>
      </BarcodeScannerProvider>
    </GestureHandlerRootView>
  );
}
