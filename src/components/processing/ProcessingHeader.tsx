import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ScannerStatusBadge from '../ScannerStatusBadge';
import type { ProcessingScreenLogic } from '../../screens/hooks/useProcessingScreenLogic';
import type { ProcessingStyles } from './styles';

type Step = ProcessingScreenLogic['state']['step'];

interface ProcessingHeaderProps {
  step: Step;
  selectedPlant: any;
  selectedGuild: any;
  isExtractive: boolean;
  onBack: () => void;
  onOpenMultiMode?: () => void;
  multiCount?: number;
  styles: ProcessingStyles;
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
          <Text style={styles.title}>Много предприятий</Text>
          <Text style={styles.headerInfoInline}>Добавлено: {multiCount}</Text>
        </View>
        <View style={styles.headerRight}>
          <ScannerStatusBadge style={styles.headerBadge} />
        </View>
      </View>
    );
  }

  if (step === 'processing' && selectedPlant) {
    const titleText = isExtractive ? 'Добыча' : 'Переработка';
    const plantInfo = `${selectedPlant.plant_level?.plant_type?.name} • Ур. ${selectedPlant.plant_level?.level} • ID: ${selectedPlant.id}`;
    const guildInfo = selectedGuild?.name ? ` • Гильдия: ${selectedGuild.name}` : null;

    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={onBack}>
          <Text style={styles.headerBackButtonText}>Назад</Text>
        </TouchableOpacity>
        <View style={styles.headerCenterRow}>
          <Text style={styles.titleInline}>{titleText}:</Text>
          <Text style={styles.headerInfoInline}>{plantInfo}</Text>
          {guildInfo && <Text style={styles.headerInfoInline}>{guildInfo}</Text>}
        </View>
        <View style={styles.headerRight}>
          {onOpenMultiMode && (
            <TouchableOpacity style={styles.headerActionButton} activeOpacity={0.7} onPress={onOpenMultiMode}>
              <Text style={styles.headerActionButtonText}>Много предприятий</Text>
            </TouchableOpacity>
          )}
          <ScannerStatusBadge style={styles.headerBadge} />
        </View>
      </View>
    );
  }

  if (step === 'plant' && selectedGuild) {
    return (
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={onBack}>
          <Text style={styles.headerBackButtonText}>Назад</Text>
        </TouchableOpacity>
        <View style={styles.headerCenterRow}>
          <Text style={styles.titleInline}>Предприятия:</Text>
          <Text style={styles.headerInfoInline}>{selectedGuild.name}</Text>
        </View>
        <View style={styles.headerRight}>
          {onOpenMultiMode && (
            <TouchableOpacity style={styles.headerActionButton} activeOpacity={0.7} onPress={onOpenMultiMode}>
              <Text style={styles.headerActionButtonText}>Много предприятий</Text>
            </TouchableOpacity>
          )}
          <ScannerStatusBadge style={styles.headerBadge} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={onBack}>
        <Text style={styles.headerBackButtonText}>Назад</Text>
      </TouchableOpacity>
      <View style={styles.headerCenterRow}>
        <Text style={styles.title}>Переработка</Text>
      </View>
      <View style={styles.headerRight}>
        {onOpenMultiMode && (
          <TouchableOpacity style={styles.headerActionButton} activeOpacity={0.7} onPress={onOpenMultiMode}>
            <Text style={styles.headerActionButtonText}>Много предприятий</Text>
          </TouchableOpacity>
        )}
        <ScannerStatusBadge style={styles.headerBadge} />
      </View>
    </View>
  );
};

export default ProcessingHeader;
