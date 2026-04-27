import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useBarcodeScannerContext } from '../context/BarcodeScannerContext';

interface ScannerStatusBadgeProps {
  style?: object;
}

const ScannerStatusBadge: React.FC<ScannerStatusBadgeProps> = ({ style }) => {
  const { isConnected } = useBarcodeScannerContext();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 152, 0, 0.15)' },
        style,
      ]}
    >
      <View
        style={[styles.dot, { backgroundColor: isConnected ? '#4caf50' : '#ff9800' }]}
      />
      <Text style={styles.text}>
        {isConnected ? 'Сканер подключён' : 'Сканер не подключён'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
});

export default ScannerStatusBadge;
