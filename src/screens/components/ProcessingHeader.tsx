import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ScannerStatusBadge from '../../components/ScannerStatusBadge';

interface ProcessingHeaderProps {
  step: string;
  selectedPlant: any;
  selectedGuild: any;
  isExtractive: boolean;
  onBack: () => void;
  onOpenMultiMode?: () => void;
  multiCount?: number;
  styles: any;
}

const ProcessingHeader: React.FC<ProcessingHeaderProps> = ({
  step,
  selectedPlant,
  selectedGuild,
  isExtractive,
  onBack,
  onOpenMultiMode,
  multiCount = 0,
  styles,
}) => {
  if (step === 'multi') {
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={onBack}>
          <Text style={styles.headerBackButtonText}>Назад</Text>
        </TouchableOpacity>
        <View style={styles.headerCenterColumn}>
          <Text style={styles.headerTitle}>Много предприятий</Text>
          <Text style={styles.headerInfoInline}>Добавлено: {multiCount}</Text>
        </View>
        <View style={styles.headerRight}>
          <ScannerStatusBadge style={styles.headerBadge} />
        </View>
      </View>
    );
  }

  const plantName = selectedPlant?.plant_level?.plant_type?.name || '';
  const plantLevel = selectedPlant?.plant_level?.level || '?';
  const guildName = selectedGuild?.name || '';
  const processType = isExtractive ? 'Добыча' : 'Переработка';

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={onBack}>
        <Text style={styles.headerBackButtonText}>Назад</Text>
      </TouchableOpacity>
      <View style={styles.headerCenterColumn}>
        <Text style={styles.headerTitle}>
          {step === 'guild' ? 'Выбор гильдии' : step === 'plant' ? 'Выбор предприятия' : `${processType}`}
        </Text>
        {selectedPlant && (
          <Text style={styles.headerInfoInline}>
            {plantName} • Ур. {plantLevel}
          </Text>
        )}
        {guildName && (
          <Text style={styles.headerInfoInline}>
            {guildName}
          </Text>
        )}
      </View>
      <View style={styles.headerRight}>
        {step === 'processing' && onOpenMultiMode && (
          <TouchableOpacity
            style={styles.headerActionButton}
            activeOpacity={0.7}
            onPress={onOpenMultiMode}
          >
            <Text style={styles.headerActionButtonText}>Много предприятий</Text>
          </TouchableOpacity>
        )}
        <ScannerStatusBadge style={styles.headerBadge} />
      </View>
    </View>
  );
};

export default ProcessingHeader;
