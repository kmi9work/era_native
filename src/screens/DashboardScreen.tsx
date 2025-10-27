import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Alert
} from 'react-native';
import { Player } from '../types';

interface DashboardScreenProps {
  player: Player;
  onLogout: () => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ player, onLogout }) => {
  const handleLogout = () => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти?',
      [
        { text: 'Отмена', style: 'cancel' },
        { 
          text: 'Выйти', 
          onPress: onLogout,
          style: 'destructive'
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добро пожаловать!</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.playerCard}>
          <Text style={styles.playerName}>{player.name}</Text>
          <Text style={styles.playerType}>{player.player_type || 'Игрок'}</Text>
          <Text style={styles.playerId}>ID: {player.identificator}</Text>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Статистика игрока</Text>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Семья:</Text>
            <Text style={styles.statValue}>{player.family || 'Не указана'}</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Должности:</Text>
            <Text style={styles.statValue}>
              {player.jobs && player.jobs.length > 0 
                ? player.jobs.join(', ') 
                : 'Не указаны'
              }
            </Text>
          </View>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Доступные функции</Text>
          
          <TouchableOpacity style={styles.featureButton} disabled>
            <Text style={styles.featureButtonText}>📊 Статистика</Text>
            <Text style={styles.featureButtonSubtext}>Скоро</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.featureButton} disabled>
            <Text style={styles.featureButtonText}>🏰 Поселения</Text>
            <Text style={styles.featureButtonSubtext}>Скоро</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.featureButton} disabled>
            <Text style={styles.featureButtonText}>⚔️ Армии</Text>
            <Text style={styles.featureButtonSubtext}>Скоро</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Мобильное приложение для Era of Change{'\n'}
            Версия 1.0.0
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1976d2',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  logoutButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  playerCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  playerType: {
    fontSize: 16,
    color: '#1976d2',
    marginBottom: 10,
  },
  playerId: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  statsContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  featuresContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  featureButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 10,
    opacity: 0.6,
  },
  featureButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  featureButtonSubtext: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  infoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  infoText: {
    color: '#1976d2',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default DashboardScreen;
