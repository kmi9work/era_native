/**
 * Уведомления мастера: окно на весь экран, закрывается только «Ок».
 *
 * Проверяем то, что нельзя увидеть в сборке: текст окна из данных сервера,
 * блокировку закрытия по «назад» (onRequestClose), подтверждение уходит на
 * бэкенд с user_id, и без выбранного мастера запрос вообще не начинается.
 */
import React from 'react';
import { Image, Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../src/services/api';
import NotificationOverlay, { NotificationOverlayView } from '../src/components/NotificationOverlay';
import { UserProvider } from '../src/context/UserContext';
import { queryClient } from '../src/data/queryClient';
import { UserSettings } from '../src/services/UserSettings';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    getNotifications: jest.fn(),
    acknowledgeNotification: jest.fn(),
    getUsers: jest.fn(),
  },
}));

const getNotifications = ApiService.getNotifications as jest.Mock;
const acknowledgeNotification = ApiService.acknowledgeNotification as jest.Mock;

const notification = {
  id: 11,
  kind: 'technology_opened',
  title: 'Открыта технология «Кузнечное дело»',
  body: 'Москва — Доступ к покупке тяжелой пехоты и кавалерии',
};

/** Собрать весь текст компонента: подпись может состоять из нескольких детей. */
const collectText = (node: any): string => {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectText).join('');

  return collectText(node.props?.children);
};

const textsOf = (tree: ReactTestRenderer): string =>
  tree.root
    .findAllByType(Text)
    .map((node) => collectText(node.props.children))
    .join(' | ');

const flush = () => act(async () => {
  await new Promise<void>((resolve) => setImmediate(() => resolve()));
  await new Promise<void>((resolve) => setImmediate(() => resolve()));
});

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.reset();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.clearAllTimers();
});

describe('уведомления мастера', () => {
  it('презентационное окно показывает заголовок и тело и не закрывается по «назад»', async () => {
    const onAcknowledge = jest.fn();
    let tree!: ReactTestRenderer;

    await act(async () => {
      tree = create(
        <NotificationOverlayView notification={notification} onAcknowledge={onAcknowledge} />,
      );
    });

    const texts = textsOf(tree);
    expect(texts).toContain('Открыта технология «Кузнечное дело»');
    expect(texts).toContain('Москва — Доступ к покупке тяжелой пехоты и кавалерии');
    expect(texts).toContain('Окно закроется только после подтверждения');

    // onRequestClose (системная «назад») не должен уметь скрыть окно
    const modal = tree.root.findAll((node) => node.props?.onRequestClose !== undefined)[0];
    expect(modal).toBeDefined();
    act(() => modal.props.onRequestClose());
    expect(textsOf(tree)).toContain('Открыта технология «Кузнечное дело»');

    const button = tree.root
      .findAllByType(TouchableOpacity)
      .find((node) => collectText(node.findAllByType(Text).map((text) => text.props.children)).includes('Ок'));
    expect(button).toBeDefined();
    act(() => button?.props.onPress());
    expect(onAcknowledge).toHaveBeenCalledTimes(1);

    act(() => tree.unmount());
  });

  /**
   * Присоединение земли: акцент на государстве (герб + название) и подсказка,
   * какие добывающие предприятия теперь доступны.
   */
  it('выделяет государство гербом и названием и перечисляет добывающие предприятия', async () => {
    const annexed = {
      id: 21,
      kind: 'region_annexed',
      title: 'Земля «Водская земля» присоединена к государству «Москва»',
      body: 'Прежнее государство: «Великий Новгород». Земля присоединена войной.',
      country: { id: 1, name: 'Москва', short_name: 'Москва', flag_image_name: 'rus' },
      payload: {
        plants: [
          { plant_type_id: 1, plant_type_name: 'Делянка', fossil_type_name: 'Строевой лес' },
          { plant_type_id: 4, plant_type_name: 'Каменоломня', fossil_type_name: 'Камень' },
        ],
      },
    };

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <NotificationOverlayView notification={annexed} onAcknowledge={jest.fn()} />,
      );
    });

    const texts = textsOf(tree);
    expect(texts).toContain('Москва');
    expect(texts).toContain('Добывающие предприятия в государстве');
    expect(texts).toContain('Делянка (Строевой лес)');
    expect(texts).toContain('Каменоломня (Камень)');

    // Герб берётся с бэкенда по flag_image_name, а не из текста названия.
    const flag = tree.root
      .findAllByType(Image)
      .find((node) => String(node.props.source?.uri).includes('/images/countries/rus.png'));
    expect(flag).toBeDefined();

    act(() => tree.unmount());
  });

  /** Итог сражения: обе стороны списком (окно мастеру сражений и политики). */
  it('показывает стороны сражения', async () => {
    const battle = {
      id: 31,
      kind: 'battle_result',
      title: 'Сражение: победа — атакующие',
      body: 'Место: Тверь. Раундов: 3.',
      country: { id: 1, name: 'Москва', short_name: 'Москва', flag_image_name: 'rus' },
      payload: {
        attackers: ['Армия Москвы (Иван)'],
        defenders: ['Армия Твери (Пётр)'],
      },
    };

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <NotificationOverlayView notification={battle} onAcknowledge={jest.fn()} />,
      );
    });

    const texts = textsOf(tree);
    expect(texts).toContain('Атакующие');
    expect(texts).toContain('Армия Москвы (Иван)');
    expect(texts).toContain('Защищающиеся');
    expect(texts).toContain('Армия Твери (Пётр)');

    act(() => tree.unmount());
  });

  it('без уведомления окно не показывается', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<NotificationOverlayView notification={null} onAcknowledge={jest.fn()} />);
    });

    const modal = tree.root.findAll((node) => node.props?.onRequestClose !== undefined)[0];
    expect(modal.props.visible).toBe(false);

    act(() => tree.unmount());
  });

  it('показывает уведомление выбранного мастера и подтверждает его с user_id', async () => {
    await UserSettings.setUser({ id: 2, name: 'Мастер', job: 'Сражения' });
    getNotifications.mockResolvedValue([notification]);
    acknowledgeNotification.mockResolvedValue(undefined);

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <UserProvider>
          <NotificationOverlay />
        </UserProvider>,
      );
    });
    await flush();

    expect(getNotifications).toHaveBeenCalledWith(2, expect.anything());
    expect(textsOf(tree)).toContain('Открыта технология «Кузнечное дело»');

    const button = tree.root
      .findAllByType(TouchableOpacity)
      .find((node) => collectText(node.findAllByType(Text).map((text) => text.props.children)).includes('Ок'));
    expect(button).toBeDefined();

    await act(async () => {
      button?.props.onPress();
    });
    await flush();

    expect(acknowledgeNotification).toHaveBeenCalledWith(11, 2);

    act(() => tree.unmount());
  });

  it('без выбранного мастера уведомления не запрашиваются', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <UserProvider>
          <NotificationOverlay />
        </UserProvider>,
      );
    });
    await flush();

    expect(getNotifications).not.toHaveBeenCalled();

    act(() => tree.unmount());
  });
});
