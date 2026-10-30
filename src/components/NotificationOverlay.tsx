/**
 * Полноэкранное уведомление мастера.
 *
 * Требование заказчика: окно всплывает на весь экран в момент события и НЕ
 * закрывается, пока мастер не нажмёт «Ок». Поэтому:
 *  - системная «назад» и тап по фону окно не закрывают (`onRequestClose` пуст);
 *  - показываем по одному из очереди неподтверждённых, «Ок» подтверждает
 *    текущее (`PATCH /notifications/:id/acknowledge.json`) и открывает следующее;
 *  - окно живёт на корне приложения, поэтому висит над любым экраном, включая бой.
 *
 * Акцент окна — государство события: герб и название рисуются отдельным блоком,
 * а не строкой в тексте. Под ним — подсказка по существу: какие добывающие
 * предприятия стали доступны (присоединение земли) или итог сражения.
 *
 * Опрос держим сами: в слое данных опрос идёт только при подписчике «в фокусе»,
 * а этот компонент не является экраном навигации.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ApiService from '../services/api';
import { useAppUser } from '../context/UserContext';
import { queryKeys } from '../data/keys';
import { queryClient } from '../data/queryClient';
import { useNotifications } from '../data/hooks/useNotifications';
import { countryFlagUrl } from '../services/images';
import type { AppNotification } from '../types';

export interface NotificationOverlayViewProps {
  notification: AppNotification | null;
  onAcknowledge: () => void;
  isAcknowledging?: boolean;
}

/**
 * Блок государства: герб + название. Название повторяет расчёт адреса герба
 * только когда сервер прислал `flag_image_name`.
 */
export const NotificationCountryBlock = ({ notification }: { notification: AppNotification }) => {
  const country = notification.country;
  if (!country) return null;

  const flag = countryFlagUrl(country.flag_image_name);

  return (
    <View style={styles.countryBlock} testID="notification-country">
      {flag ? (
        <Image
          source={{ uri: flag }}
          style={styles.countryFlag}
          resizeMode="contain"
          accessibilityLabel={`Герб государства ${country.name}`}
        />
      ) : null}
      <Text style={styles.countryName}>{country.name}</Text>
    </View>
  );
};

/** Список строк одного блока подсказки (предприятия или стороны сражения). */
const NotificationList = ({ title, items }: { title: string; items: string[] }) => {
  if (items.length === 0) return null;

  return (
    <View style={styles.list}>
      <Text style={styles.listTitle}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.listItem}>
          • {item}
        </Text>
      ))}
    </View>
  );
};

/** Презентационная часть: тестируется без контекста и без сети. */
export const NotificationOverlayView = ({
  notification,
  onAcknowledge,
  isAcknowledging = false,
}: NotificationOverlayViewProps) => {
  const payload = notification?.payload ?? {};
  const plants = useMemo(
    () => (Array.isArray(payload.plants) ? payload.plants : []).map((plant) => (
      plant.fossil_type_name
        ? `${plant.plant_type_name} (${plant.fossil_type_name})`
        : plant.plant_type_name
    )),
    [payload.plants],
  );
  const attackers = Array.isArray(payload.attackers) ? payload.attackers : [];
  const defenders = Array.isArray(payload.defenders) ? payload.defenders : [];

  return (
    <Modal
      visible={notification !== null}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      // Пустой обработчик — сознательно: уйти с окна можно только кнопкой «Ок».
      onRequestClose={() => {}}
    >
      <View style={styles.container} testID="notification-overlay">
        <Text style={styles.icon}>🔔</Text>

        {notification ? <NotificationCountryBlock notification={notification} /> : null}

        <Text style={styles.title}>{notification?.title ?? ''}</Text>
        {notification?.body ? <Text style={styles.body}>{notification.body}</Text> : null}

        <NotificationList title="Добывающие предприятия в государстве" items={plants} />
        <NotificationList title="Атакующие" items={attackers} />
        <NotificationList title="Защищающиеся" items={defenders} />

        <Text style={styles.hint}>Окно закроется только после подтверждения</Text>

        <TouchableOpacity
          style={[styles.button, isAcknowledging && styles.buttonDisabled]}
          onPress={onAcknowledge}
          disabled={isAcknowledging}
          accessibilityRole="button"
          accessibilityLabel="Подтвердить уведомление"
        >
          <Text style={styles.buttonText}>Ок</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const NotificationOverlay = () => {
  const { user, isReady } = useAppUser();
  const userId = isReady ? user?.id ?? null : null;
  const userIdString = userId == null ? '' : String(userId);

  const query = useNotifications(userId);
  const notifications = useMemo(() => (query.data as AppNotification[]) ?? [], [query.data]);
  const current = notifications[0] ?? null;

  const [isAcknowledging, setIsAcknowledging] = useState(false);

  // Опрос включается только у ключа «в фокусе»: держим фокус на всё время жизни
  // приложения, иначе уведомление пришло бы лишь при возврате на экран.
  useEffect(() => {
    if (userId == null) return undefined;

    const key = queryKeys.notifications(userId);
    queryClient.setFocused(key, 1);

    return () => {
      queryClient.setFocused(key, -1);
    };
  }, [userIdString]); // eslint-disable-line react-hooks/exhaustive-deps

  const acknowledge = useCallback(async () => {
    if (!current || userId == null || isAcknowledging) return;

    setIsAcknowledging(true);
    try {
      await ApiService.acknowledgeNotification(current.id, userId);
      // Подтверждение снимает окно на ВСЕХ устройствах этого мастера — поэтому
      // перечитываем список у сервера, а не просто выкидываем строку локально.
      await queryClient.refetch([queryKeys.notifications(userId)], { force: true });
    } catch (error) {
      // Нет связи — окно остаётся на экране, следующий опрос повторит попытку.
    } finally {
      setIsAcknowledging(false);
    }
  }, [current, userId, isAcknowledging]);

  return (
    <NotificationOverlayView
      notification={current}
      onAcknowledge={acknowledge}
      isAcknowledging={isAcknowledging}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 56,
    marginBottom: 12,
  },
  /* Государство события — главный акцент окна: герб слева, название крупно. */
  countryBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#eef4fb',
    borderWidth: 2,
    borderColor: '#c3d8ef',
    marginBottom: 20,
  },
  countryFlag: {
    width: 96,
    height: 64,
    marginRight: 16,
  },
  countryName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#123a63',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  body: {
    fontSize: 20,
    textAlign: 'center',
    color: '#444444',
    marginBottom: 16,
    maxWidth: 900,
  },
  list: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 14,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#123a63',
    marginBottom: 6,
  },
  listItem: {
    fontSize: 20,
    color: '#1a1a1a',
  },
  hint: {
    fontSize: 15,
    textAlign: 'center',
    color: '#8a8a8a',
    marginBottom: 32,
  },
  button: {
    minWidth: 220,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: '#1e88e5',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default NotificationOverlay;
