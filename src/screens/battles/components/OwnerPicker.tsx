/**
 * Выбор нового владельца взятого города.
 *
 * Список — все игроки игры (`GET /players.json`), но нападавшие идут первыми и с
 * пометкой: владельцем чаще всего становится тот, кто взял город. Поиск по имени и
 * государству нужен потому, что игроков в игре десятки. Список на `ScrollView`, а не
 * на `FlatList`: в тестах экрана виртуализация рендерит только первые строки.
 */
import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export interface OwnerChoice {
  id: number;
  name: string;
  countryName: string;
  /** Игрок нападал в этом бою — поднимаем его вверх списка. */
  attacked: boolean;
}

interface Props {
  visible: boolean;
  choices: OwnerChoice[];
  busy: boolean;
  onPick: (playerId: number) => void;
  onClose: () => void;
}

const OwnerPicker: React.FC<Props> = ({ visible, choices, busy, onPick, onClose }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return choices;
    return choices.filter(choice =>
      `${choice.name} ${choice.countryName}`.toLowerCase().includes(needle),
    );
  }, [choices, query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Новый владелец города</Text>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Имя игрока или государство"
            placeholderTextColor="#90a4ae"
            accessibilityLabel="Поиск игрока"
          />
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <Text style={styles.empty}>Игроки не найдены</Text>
            ) : (
              filtered.map(choice => (
                <TouchableOpacity
                  key={choice.id}
                  style={styles.row}
                  onPress={() => onPick(choice.id)}
                  disabled={busy}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{choice.name}</Text>
                    {choice.countryName ? (
                      <Text style={styles.country}>{choice.countryName}</Text>
                    ) : null}
                  </View>
                  {choice.attacked ? <Text style={styles.badge}>нападал</Text> : null}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 30, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    maxHeight: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#263238',
    marginBottom: 8,
  },
  search: {
    borderWidth: 1,
    borderColor: '#cfd8dc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#263238',
    marginBottom: 8,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eceff1',
  },
  rowText: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: '#263238',
  },
  country: {
    fontSize: 11,
    color: '#78909c',
    marginTop: 2,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1565c0',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  empty: {
    fontSize: 12,
    color: '#78909c',
    paddingVertical: 14,
    textAlign: 'center',
  },
  close: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#546e7a',
  },
});

export default OwnerPicker;
