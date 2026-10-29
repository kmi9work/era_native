/**
 * «Рынок» в era_native: эмбарго на гильдию и сохранение ввода при обновлении.
 *
 * Два дефекта, которые держит этот тест:
 *  1) эмбарго в many_teams накладывается на ГИЛЬДИЮ (карта «страна → эмбарго»
 *     приходит из `GET /many_teams/guild_embargoes/market?guild_id=`), поэтому
 *     страна-эмбаргодержатель должна подсвечиваться красным, а «Посчитать» —
 *     предупреждать так же, как «Рынок» в веб-админке;
 *  2) регулярное обновление цен (опрос раз в 60 с) пересоздавало строки формы
 *     с `count: null` и стирало введённые мастером числа.
 */
import React from 'react';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { queryKeys } from '../src/data/keys';
import { queryClient } from '../src/data/queryClient';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactMock = require('react');
    ReactMock.useEffect(callback, [callback]);
  },
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

// Игра фиксируется тестом: рынок ведёт себя по-разному в базовой игре и many_teams.
jest.mock('../src/config/game', () => ({
  gameConfig: {
    activeGame: 'many-teams',
    availableGames: {},
    isActive: (name: string) => name === 'many-teams',
  },
  useGameConfig: () => ({
    activeGame: 'many-teams',
    isGameActive: (name: string) => name === 'many-teams',
    activeGameInfo: null,
  }),
}));

// Шильдик сканера требует Bluetooth-контекста (нативного модуля в тесте нет).
jest.mock('../src/components/ScannerStatusBadge', () => () => null);

jest.mock('../src/services/api', () => {
  const guilds = [{ id: 1, name: 'Забавники' }];
  const countries = [
    { id: 2, name: 'Большая Орда', short_name: 'Орда', params: { embargo: 0 } },
    { id: 3, name: 'Ливонский орден', short_name: 'Ливония', params: { embargo: 0 } },
  ];
  const prices = {
    prices: {
      to_market: [{ identificator: 'timber', name: 'Лес', country_id: 2, sell_price: 5 }],
      off_market: [{ identificator: 'boards', name: 'Доски', country_id: 2, buy_price: 7 }],
    },
  };
  // Эмбарго на гильдию «Забавники» наложила Орда.
  const embargo = {
    countries: [
      { id: 2, name: 'Большая Орда', short_name: 'Орда', embargoed: true },
      { id: 3, name: 'Ливонский орден', short_name: 'Ливония', embargoed: false },
    ],
  };

  return {
    __esModule: true,
    default: {
      getGuilds: jest.fn(async () => guilds),
      getForeignCountries: jest.fn(async () => countries),
      getResourcesWithPrices: jest.fn(async () => prices),
      checkRobbery: jest.fn(async () => ({ probability: 0 })),
      registerCaravan: jest.fn(async () => ({})),
      get: jest.fn(async (path: string) => {
        if (path.startsWith('/many_teams/guild_embargoes/market')) {
          return embargo;
        }
        throw new Error(`Неожиданный запрос: ${path}`);
      }),
      getBaseUrl: () => 'http://example.test',
    },
  };
});

import ApiService from '../src/services/api';

const MarketScreen = require('../src/screens/MarketScreen').default;

const collectText = (node: unknown, out: string[] = []): string[] => {
  if (node === null || node === undefined) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, out));
    return out;
  }
  const children = (node as { children?: unknown }).children;
  if (children) collectText(children, out);
  return out;
};

const settle = async (times = 6) => {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    });
  }
};

const renderScreen = async (): Promise<ReactTestRenderer> => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<MarketScreen />);
  });
  await settle();
  return tree;
};

const textsOf = (node: ReactTestRenderer | object): string[] => collectText(
  'toJSON' in (node as ReactTestRenderer) ? (node as ReactTestRenderer).toJSON() : node,
);

/** TouchableOpacity, в подписи которого есть нужный текст. */
const findTouchable = (tree: ReactTestRenderer, label: string) => {
  const touchable = tree.root.findAllByType(TouchableOpacity).find((node) => {
    const texts = node.findAllByType(Text).map((textNode) => collectText(textNode.props.children).join(''));
    return texts.some((text) => text === label);
  });
  if (!touchable) {
    throw new Error(`Элемент «${label}» не найден`);
  }
  return touchable;
};

const findInput = (tree: ReactTestRenderer, placeholderPrefix: string) => {
  const input = tree.root.findAllByType(TextInput).find((node) =>
    String(node.props.placeholder || '').startsWith(placeholderPrefix),
  );
  if (!input) {
    throw new Error(`Поле ввода «${placeholderPrefix}» не найдено`);
  }
  return input;
};

describe('«Рынок»: эмбарго на гильдию (many_teams)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    queryClient.reset();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    queryClient.reset();
  });

  const openMarketForm = async (tree: ReactTestRenderer) => {
    await act(async () => {
      findTouchable(tree, 'Забавники').props.onPress?.();
    });
    await settle();
  };

  it('спрашивает карту эмбарго по выбранной гильдии', async () => {
    const tree = await renderScreen();
    await openMarketForm(tree);

    expect(ApiService.get).toHaveBeenCalledWith(
      '/many_teams/guild_embargoes/market?guild_id=1',
      expect.anything(),
    );

    await act(async () => {
      tree.unmount();
    });
  });

  it('подсвечивает красным страну, наложившую эмбарго', async () => {
    const tree = await renderScreen();
    await openMarketForm(tree);

    const orda = findTouchable(tree, 'Орда');
    const livonia = findTouchable(tree, 'Ливония');

    expect(textsOf(orda)).toContain('Эмбарго');
    expect(textsOf(livonia)).not.toContain('Эмбарго');

    const ordaStyle = ([] as any[]).concat(orda.props.style).flat();
    expect(ordaStyle.some((style: any) => style?.borderColor === '#f44336')).toBe(true);
    // Подсказка под списком стран объясняет, что значит красный цвет.
    expect(textsOf(tree).join(' ')).toContain('наложившие эмбарго на выбранную гильдию');

    await act(async () => {
      tree.unmount();
    });
  });

  it('«Посчитать» по стране с эмбарго показывает предупреждение о контрабанде', async () => {
    const tree = await renderScreen();
    await openMarketForm(tree);

    await act(async () => {
      findInput(tree, 'Лес').props.onChangeText?.('25');
      findInput(tree, 'Золото').props.onChangeText?.('1000');
    });

    await act(async () => {
      findTouchable(tree, 'Посчитать').props.onPress?.();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Эта страна наложила эмбарго на гильдию!',
      expect.stringContaining('«Контрабанда»'),
      expect.any(Array),
    );

    await act(async () => {
      tree.unmount();
    });
  });

  it('фоновое обновление цен не сбрасывает введённые числа', async () => {
    const tree = await renderScreen();
    await openMarketForm(tree);

    await act(async () => {
      findInput(tree, 'Лес').props.onChangeText?.('25');
    });
    const before = findInput(tree, 'Лес');
    expect(before.props.value).toBe('25');

    // Новый ответ сервера — как при опросе цен раз в 60 с (цена изменилась).
    (ApiService.getResourcesWithPrices as jest.Mock).mockResolvedValueOnce({
      prices: {
        to_market: [{ identificator: 'timber', name: 'Лес', country_id: 2, sell_price: 6 }],
        off_market: [{ identificator: 'boards', name: 'Доски', country_id: 2, buy_price: 7 }],
      },
    });
    await act(async () => {
      await queryClient.refetch([queryKeys.prices()], { force: true });
    });
    await settle(2);

    const after = findInput(tree, 'Лес');
    expect(after.props.value).toBe('25');

    await act(async () => {
      tree.unmount();
    });
  });

  it('введённые числа обнуляются только при смене страны', async () => {
    const tree = await renderScreen();
    await openMarketForm(tree);

    await act(async () => {
      findInput(tree, 'Лес').props.onChangeText?.('25');
    });

    (ApiService.getResourcesWithPrices as jest.Mock).mockResolvedValueOnce({
      prices: {
        to_market: [
          { identificator: 'timber', name: 'Лес', country_id: 3, sell_price: 9 },
        ],
        off_market: [{ identificator: 'boards', name: 'Доски', country_id: 3, buy_price: 7 }],
      },
    });

    await act(async () => {
      findTouchable(tree, 'Ливония').props.onPress?.();
    });
    await settle(3);

    const input = tree.root
      .findAllByType(TextInput)
      .find((node) => String(node.props.placeholder || '').startsWith('Лес'));
    // У Ливонии своего леса в ответе нет — прежний ввод к ней не относится,
    // поэтому поле либо отсутствует, либо пустое.
    expect(input === undefined || input.props.value === '').toBe(true);

    await act(async () => {
      tree.unmount();
    });
  });
});
