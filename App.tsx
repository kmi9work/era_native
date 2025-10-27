import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';

// Импорт экранов
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PlantWorkshopScreen from './src/screens/PlantWorkshopScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';
import { Player } from './src/types';

export default function App() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'dashboard' | 'settings' | 'plantWorkshop' | 'processing'>('login');

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

  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Простой splash screen */}
      </View>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return player ? (
          <DashboardScreen 
            player={player} 
            onLogout={handleLogout} 
          />
        ) : (
          <LoginScreen 
            onLoginSuccess={handleLogin}
            onSettings={handleOpenSettings}
          />
        );
      case 'settings':
        return (
          <SettingsScreen 
            onClose={handleCloseSettings}
            onPlantWorkshop={handleOpenPlantWorkshop}
            onProcessing={handleOpenProcessing}
          />
        );
      case 'plantWorkshop':
        return (
          <PlantWorkshopScreen 
            onClose={handleClosePlantWorkshop}
          />
        );
      case 'processing':
        return (
          <ProcessingScreen 
            onClose={handleCloseProcessing}
          />
        );
      case 'login':
      default:
        return (
          <LoginScreen 
            onLoginSuccess={handleLogin}
            onSettings={handleOpenSettings}
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      {renderScreen()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});


