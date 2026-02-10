import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { BarcodeScannerProvider } from './src/context/BarcodeScannerContext';

// Импорт экранов ядра
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PlantWorkshopScreen from './src/screens/PlantWorkshopScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';

// Импорт registry и плагинов
import { componentRegistry } from './src/registry';
import { initializePlugins } from './src/plugins';
import { Player } from './src/types';

// Регистрируем компоненты ядра
componentRegistry.register('LoginScreen', LoginScreen, true);
componentRegistry.register('DashboardScreen', DashboardScreen, true);
componentRegistry.register('SettingsScreen', SettingsScreen, true);
componentRegistry.register('PlantWorkshopScreen', PlantWorkshopScreen, true);
componentRegistry.register('ProcessingScreen', ProcessingScreen, true);

// Инициализируем плагины (могут переопределить компоненты)
initializePlugins();

export default function App() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'dashboard' | 'settings' | 'plantWorkshop' | 'processing' | 'market'>('login');

  useEffect(() => {
    // Имитация загрузки
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (playerData: Player) => {
    setPlayer(playerData);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    setPlayer(null);
    setCurrentScreen('login');
  };

  const handleOpenSettings = () => {
    setCurrentScreen('settings');
  };

  const handleCloseSettings = () => {
    if (player) {
      setCurrentScreen('dashboard');
    } else {
      setCurrentScreen('login');
    }
  };

  const handleOpenPlantWorkshop = () => {
    setCurrentScreen('plantWorkshop');
  };

  const handleClosePlantWorkshop = () => {
    setCurrentScreen('settings');
  };

  const handleOpenProcessing = () => {
    setCurrentScreen('processing');
  };

  const handleCloseProcessing = () => {
    setCurrentScreen('settings');
  };

  const handleOpenMarket = () => {
    setCurrentScreen('market');
  };

  const handleCloseMarket = () => {
    setCurrentScreen('settings');
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Простой splash screen */}
      </View>
    );
  }

  const renderScreen = () => {
    // Получаем компоненты из registry (могут быть переопределены плагином)
    // Убеждаемся, что компоненты определены и являются функциями/классами компонентов
    const LoginScreenComponent = componentRegistry.get('LoginScreen');
    const DashboardScreenComponent = componentRegistry.get('DashboardScreen');
    const SettingsScreenComponent = componentRegistry.get('SettingsScreen');
    const PlantWorkshopScreenComponent = componentRegistry.get('PlantWorkshopScreen');
    const ProcessingScreenComponent = componentRegistry.get('ProcessingScreen');

    // Используем компоненты из registry или fallback на импортированные
    const LoginComp = LoginScreenComponent && typeof LoginScreenComponent === 'function' ? LoginScreenComponent : LoginScreen;
    const DashboardComp = DashboardScreenComponent && typeof DashboardScreenComponent === 'function' ? DashboardScreenComponent : DashboardScreen;
    const SettingsComp = SettingsScreenComponent && typeof SettingsScreenComponent === 'function' ? SettingsScreenComponent : SettingsScreen;
    const PlantWorkshopComp = PlantWorkshopScreenComponent && typeof PlantWorkshopScreenComponent === 'function' ? PlantWorkshopScreenComponent : PlantWorkshopScreen;
    const ProcessingComp = ProcessingScreenComponent && typeof ProcessingScreenComponent === 'function' ? ProcessingScreenComponent : ProcessingScreen;

    switch (currentScreen) {
      case 'dashboard':
        return player ? (
          <DashboardComp 
            player={player} 
            onLogout={handleLogout} 
          />
        ) : (
          <LoginComp 
            onLoginSuccess={handleLogin}
            onSettings={handleOpenSettings}
          />
        );
      case 'settings':
        return (
          <SettingsComp 
            onClose={handleCloseSettings}
            onPlantWorkshop={handleOpenPlantWorkshop}
            onProcessing={handleOpenProcessing}
            onMarket={handleOpenMarket}
          />
        );
      case 'plantWorkshop':
        return (
          <PlantWorkshopComp 
            onClose={handleClosePlantWorkshop}
          />
        );
      case 'processing':
        return (
          <ProcessingComp 
            onClose={handleCloseProcessing}
          />
        );
      case 'market':
        return (
          <PlantWorkshopComp 
            onClose={handleCloseMarket}
            initialStep="market"
          />
        );
      case 'login':
      default:
        return (
          <LoginComp 
            onLoginSuccess={handleLogin}
            onSettings={handleOpenSettings}
          />
        );
    }
  };

  return (
    <BarcodeScannerProvider>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        {renderScreen()}
      </View>
    </BarcodeScannerProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});


