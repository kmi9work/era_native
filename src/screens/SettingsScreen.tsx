import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BrotherPrinterService } from '../services/BrotherPrinterService';
import ScannerStatusBadge from '../components/ScannerStatusBadge';

// Navigation prop приходит автоматически от React Navigation
const SettingsScreen = () => {
  const navigation = useNavigation();
  const [printerIp, setPrinterIp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  useEffect(() => {
    loadPrinterSettings();
  }, []);

  const loadPrinterSettings = async () => {
    try {
      const ip = await BrotherPrinterService.getPrinterIp();
      setPrinterIp(ip || '192.168.1.147'); // Значение по умолчанию
    } catch (error) {
      setPrinterIp('192.168.1.147'); // Значение по умолчанию при ошибке
    }
  };

  const handleSavePrinterIp = async () => {
    if (!printerIp.trim()) {
      Alert.alert('Ошибка', 'Введите IP-адрес принтера');
      return;
    }

    setIsLoading(true);
    try {
      await BrotherPrinterService.setPrinterIp(printerIp.trim());
      Alert.alert('Успех', 'IP-адрес принтера сохранен');
      setConnectionStatus('unknown');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить IP-адрес принтера');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!printerIp.trim()) {
      Alert.alert('Ошибка', 'Введите IP-адрес принтера');
      return;
    }

    setIsLoading(true);
    setConnectionStatus('unknown');
    
    try {
      const result = await BrotherPrinterService.testConnection(printerIp.trim());
      if (result.success) {
        setConnectionStatus('connected');
        Alert.alert('Успех', 'Подключение к принтеру установлено');
      } else {
        setConnectionStatus('disconnected');
        Alert.alert('Ошибка', result.error || 'Не удалось подключиться к принтеру');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      Alert.alert('Ошибка', 'Ошибка проверки подключения');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchPrinters = async () => {
    setIsLoading(true);
    try {
      const printers = await BrotherPrinterService.searchPrinters();
      if (printers.length > 0) {
        Alert.alert(
          'Найденные принтеры',
          printers.map(p => `${p.name || 'Brother Printer'} (${p.ip})`).join('\n')
        );
      } else {
        Alert.alert('Информация', 'Принтеры Brother не найдены в сети');
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Ошибка поиска принтеров');
    } finally {
      setIsLoading(false);
    }
  };


  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4caf50';
      case 'disconnected': return '#f44336';
      default: return '#ff9800';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Подключен';
      case 'disconnected': return 'Не подключен';
      default: return 'Не проверено';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Настройки</Text>
        <View style={styles.headerRight}>
          <ScannerStatusBadge style={styles.headerBadge} />
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Рабочие места</Text>
          
          <TouchableOpacity 
            style={styles.settingButton}
            onPress={() => navigation.navigate('PlantWorkshop' as never)}
          >
            <Text style={styles.settingButtonIcon}>🏭</Text>
            <View style={styles.settingButtonContent}>
              <Text style={styles.settingButtonText}>Обработка предприятий</Text>
              <Text style={styles.settingButtonDescription}>
                Создание и улучшение предприятий
              </Text>
            </View>
            <Text style={styles.settingButtonArrow}>›</Text>
          </TouchableOpacity>

          {/* Переработка — зарезервировано для будущего использования */}
          {/* <TouchableOpacity 
            style={styles.settingButton}
            onPress={() => navigation.navigate('Processing' as never)}
          >
            <Text style={styles.settingButtonIcon}>⚙️</Text>
            <View style={styles.settingButtonContent}>
              <Text style={styles.settingButtonText}>Переработка</Text>
              <Text style={styles.settingButtonDescription}>
                Переработка ресурсов на предприятиях
              </Text>
            </View>
            <Text style={styles.settingButtonArrow}>›</Text>
          </TouchableOpacity> */}

          <TouchableOpacity 
            style={styles.settingButton}
            onPress={() => navigation.navigate('Market' as never)}
          >
            <Text style={styles.settingButtonIcon}>💰</Text>
            <View style={styles.settingButtonContent}>
              <Text style={styles.settingButtonText}>Рынок</Text>
              <Text style={styles.settingButtonDescription}>
                Торговля с иностранными странами
              </Text>
            </View>
            <Text style={styles.settingButtonArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Принтер</Text>
          
          <View style={styles.printerSettingsBlock}>
            <Text style={styles.inputLabel}>IP-адрес принтера Brother QL-810W:</Text>
            <TextInput
              style={styles.ipInput}
              value={printerIp}
              onChangeText={setPrinterIp}
              placeholder="192.168.1.147"
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <View style={styles.printerButtonsRow}>
              <TouchableOpacity 
                style={[styles.printerButton, styles.saveButton]}
                onPress={handleSavePrinterIp}
                disabled={isLoading}
              >
                <Text style={styles.printerButtonText}>Сохранить</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.printerButton, styles.testButton]}
                onPress={handleTestConnection}
                disabled={isLoading}
              >
                <Text style={styles.printerButtonText}>Проверить</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.printerButton}
              onPress={handleSearchPrinters}
              disabled={isLoading}
            >
              <Text style={styles.printerButtonText}>Найти принтеры в сети</Text>
            </TouchableOpacity>
            
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#1976d2" />
                <Text style={styles.loadingText}>Обработка...</Text>
              </View>
            )}
            
            <View style={styles.connectionStatus}>
              <View style={[styles.statusIndicator, { backgroundColor: getConnectionStatusColor() }]} />
              <Text style={styles.statusText}>
                Статус: {getConnectionStatusText()}
              </Text>
            </View>
          </View>
        </View>


        <View style={styles.section}>
          <Text style={styles.sectionTitle}>О приложении</Text>
          <View style={styles.infoBlock}>
            <Text style={styles.infoText}>Версия: 1.0.0</Text>
            <Text style={styles.infoText}>Эпоха перемен</Text>
          </View>
        </View>
      </ScrollView>

    </View>
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
  headerRight: {
     flexDirection: 'row',
     alignItems: 'center',
   },
   headerBadge: {
     backgroundColor: 'rgba(255,255,255,0.25)',
   },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingButtonIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  settingButtonContent: {
    flex: 1,
  },
  settingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingButtonDescription: {
    fontSize: 13,
    color: '#666',
  },
  settingButtonArrow: {
    fontSize: 24,
    color: '#999',
  },
  infoBlock: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  printerSettingsBlock: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  ipInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 15,
  },
  printerButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  printerButton: {
    flex: 1,
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#4caf50',
  },
  testButton: {
    backgroundColor: '#ff9800',
  },
  printerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
});

export default SettingsScreen;

