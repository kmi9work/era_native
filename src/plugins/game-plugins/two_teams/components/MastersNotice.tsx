import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Надпись для мастеров (п. 8): обработка добычи и переработки предприятий
 * ведётся только в программе, на бумаге её не считают.
 */
export default function MastersNotice({ text }: { text?: string }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>
        {text || 'Обработка добычи и переработки предприятий ТОЛЬКО в программе'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: '#f9a825',
    borderColor: '#f57f17',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: 12,
    marginTop: 8,
  },
  noticeText: {
    color: '#3e2723',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
});
