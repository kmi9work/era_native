/**
 * Лента боя: последние события сцены одной строкой каждое.
 *
 * Нужна не для красоты: игроки должны видеть числа, из которых сложился
 * результат («Конница: 5 — попадание», «Пехота уничтожен»), иначе бой
 * выглядит как исчезновение фишек без причины.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BattleLogProps {
  lines: string[];
  /** Сколько последних строк показывать. */
  limit?: number;
}

const BattleLog: React.FC<BattleLogProps> = ({ lines, limit = 3 }) => {
  const visible = lines.slice(-limit);
  return (
    <View style={styles.container}>
      {visible.length === 0 ? (
        <Text style={styles.empty}>Ждём броска — события боя появятся здесь.</Text>
      ) : (
        visible.map((line, index) => (
          <Text
            key={`${index}-${line}`}
            style={[styles.line, index === visible.length - 1 ? styles.lineFresh : null]}
            numberOfLines={1}
          >
            {line}
          </Text>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#263238',
    minHeight: 34,
    justifyContent: 'center',
  },
  empty: {
    fontSize: 10,
    color: '#90a4ae',
  },
  line: {
    fontSize: 11,
    color: '#b0bec5',
    lineHeight: 14,
  },
  lineFresh: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default BattleLog;
