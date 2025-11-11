import React from 'react';
import { View } from 'react-native';
import ProcessingHeader from '../components/processing/ProcessingHeader';
import ProcessingContent from '../components/processing/ProcessingContent';
import { processingStyles } from '../components/processing/styles';
import { useProcessingScreenLogic } from './hooks/useProcessingScreenLogic';

interface ProcessingScreenProps {
  onClose: () => void;
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ onClose }) => {
  const logic = useProcessingScreenLogic(onClose);

  const {
    state: { step, loading },
    selections: { selectedGuild, selectedPlant },
    processingMeta,
    handlers: { handleBack },
  } = logic;

  const styles = processingStyles;

  return (
    <View style={styles.container}>
      <ProcessingHeader
        step={step}
        selectedPlant={selectedPlant}
        selectedGuild={selectedGuild}
        isExtractive={processingMeta.isExtractive}
        onBack={handleBack}
        styles={styles}
      />
      <ProcessingContent
        step={step}
        loading={loading}
        selections={logic.selections}
        formulas={logic.formulas}
        inputs={logic.inputs}
        results={logic.results}
        processingMeta={processingMeta}
        effects={logic.effects}
        helpers={logic.helpers}
        handlers={{
          handleSelectGuild: logic.handlers.handleSelectGuild,
          handleSelectPlant: logic.handlers.handleSelectPlant,
          calculateFrom: logic.handlers.calculateFrom,
          calculateTo: logic.handlers.calculateTo,
        }}
        styles={styles}
      />
    </View>
  );
};

export default ProcessingScreen;

