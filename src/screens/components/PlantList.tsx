import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { EnterpriseData } from '../hooks/useEnterpriseManagement';

interface PlantListProps {
  plants: EnterpriseData[];
  onSelectPlant: (plant: EnterpriseData) => void;
  onDeletePlant?: (plant: EnterpriseData) => void;
  loading?: boolean;
}

/**
 * Общий компонент списка предприятий.
 * Отображает список предприятий с возможностью выбора и удаления.
 */
export default function PlantList({
  plants,
  onSelectPlant,
  onDeletePlant,
  loading = false,
}: PlantListProps) {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  if (plants.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>У гильдии пока нет предприятий</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Мои предприятия:</Text>
      <ScrollView style={styles.list}>
        {plants.map((plant) => (
          <View key={plant.id} style={styles.itemContainer}>
            <TouchableOpacity
              style={styles.itemButton}
              activeOpacity={0.7}
              onPress={() => onSelectPlant(plant)}
            >
              <View style={styles.itemContent}>
                <Text style={styles.itemText}>
                  {plant.plant_level?.plant_type?.name || 'Предприятие'}
                </Text>
                <Text style={styles.itemSubtext}>
                  Уровень {plant.plant_level?.level || '?'} • ID: {plant.id}
                </Text>
              </View>
              <Text style={styles.itemArrow}>›</Text>
            </TouchableOpacity>
            {onDeletePlant && (
              <TouchableOpacity
                style={styles.deleteButton}
                activeOpacity={0.7}
                onPress={() => onDeletePlant(plant)}
              >
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  container: {
    flex: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  itemButton: {
    flex: 1,
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
    minHeight: 60,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  itemArrow: {
    fontSize: 24,
    color: '#999',
  },
  deleteButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 50,
    minHeight: 60,
  },
  deleteIcon: {
    fontSize: 24,
  },
});
