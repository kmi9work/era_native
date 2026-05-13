import React from 'react';
import { View, StyleSheet } from 'react-native';
import ProcessingHeader from './components/ProcessingHeader';
import ProcessingContent from './components/ProcessingContent';
import ProcessingMultiContent from './components/processing/ProcessingMultiContent';
import { processingStyles } from './components/processing/styles';
import { useProcessingScreenLogic } from './hooks/useProcessingScreenLogic';

interface ProcessingScreenProps {
  onClose?: () => void;
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ onClose }) => {
  const logic = useProcessingScreenLogic(onClose || (() => {}));

  const {
    state: { step, loading, refreshing, onRefresh },
    selections,
    processingMeta,
    handlers,
    multi,
    helpers,
  } = logic;

  const { selectedGuild, selectedPlant } = selections;
  const {
    handleBack,
    handleSelectGuild,
    handleSelectPlant,
    calculateFrom,
    calculateTo,
    openMultiMode,
    removeMultiEntry,
    clearMultiEntries,
    setMultiEntryInputFromValue,
    calculateMultiFrom,
  } = handlers;

  const styles = processingStyles;

  return (
    <View style={styles.container}>
      <ProcessingHeader
        step={step}
        selectedPlant={selectedPlant}
        selectedGuild={selectedGuild}
        isExtractive={processingMeta.isExtractive}
        onBack={handleBack}
        onOpenMultiMode={openMultiMode}
        multiCount={multi.entries.length}
        styles={styles}
      />
      {step === 'multi' ? (
        <ProcessingMultiContent
          loading={loading}
          entries={multi.entries}
          totals={multi.totals}
          helpers={helpers}
          handlers={{
            removeEntry: removeMultiEntry,
            clearEntries: clearMultiEntries,
            setEntryInputFromValue: setMultiEntryInputFromValue,
            calculateFrom: calculateMultiFrom,
          }}
          styles={styles}
        />
      ) : (
        <ProcessingContent
          step={step}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          selections={logic.selections}
          formulas={logic.formulas}
          inputs={logic.inputs}
          results={logic.results}
          processingMeta={processingMeta}
          helpers={helpers}
          handlers={{
            handleSelectGuild,
            handleSelectPlant,
            calculateFrom,
            calculateTo,
          }}
          styles={styles}
        />
      )}
    </View>
  );
};

export default ProcessingScreen;
