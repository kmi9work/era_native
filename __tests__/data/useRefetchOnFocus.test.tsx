/**
 * Тесты useRefetchOnFocus (ТЗ § 9, Д5): фокус → обновление ровно переданных
 * ключей, размонтирование снимает подписчика и потерю фокуса.
 *
 * useFocusEffect подменяется на useEffect: в тестовой среде нет навигатора.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { queryKeys } from '../../src/data/keys';
import { queryClient } from '../../src/data/queryClient';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactMock = require('react');
    ReactMock.useEffect(callback, [callback]);
  },
}));

const { useRefetchOnFocus } = require('../../src/data/useRefetchOnFocus');

const renderHook = (hook: () => void) => {
  const Component = () => {
    hook();
    return null;
  };

  let tree: ReactTestRenderer;
  act(() => {
    tree = create(<Component />);
  });

  return { unmount: () => act(() => tree.unmount()) };
};

describe('useRefetchOnFocus', () => {
  beforeEach(() => {
    queryClient.reset();
  });

  afterEach(() => {
    queryClient.reset();
    jest.restoreAllMocks();
  });

  it('при получении фокуса обновляет ровно переданные ключи', () => {
    const guilds = queryKeys.guilds();
    const countries = queryKeys.countries();
    const setFocused = jest.spyOn(queryClient, 'setFocused');
    const refetch = jest.spyOn(queryClient, 'refetch').mockResolvedValue(undefined);

    const hook = renderHook(() => useRefetchOnFocus([guilds, countries]));

    expect(setFocused).toHaveBeenCalledTimes(2);
    expect(setFocused).toHaveBeenCalledWith(guilds, 1);
    expect(setFocused).toHaveBeenCalledWith(countries, 1);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledWith([guilds, countries], { force: true });

    hook.unmount();
  });

  it('размонтирование снимает фокус с тех же ключей', () => {
    const plants = queryKeys.guildPlants(3);
    const setFocused = jest.spyOn(queryClient, 'setFocused');
    jest.spyOn(queryClient, 'refetch').mockResolvedValue(undefined);

    const hook = renderHook(() => useRefetchOnFocus([plants]));
    setFocused.mockClear();

    hook.unmount();

    expect(setFocused).toHaveBeenCalledTimes(1);
    expect(setFocused).toHaveBeenCalledWith(plants, -1);
  });

  it('пустые (невалидные) ключи не подписывают ничего', () => {
    const setFocused = jest.spyOn(queryClient, 'setFocused');
    const refetch = jest.spyOn(queryClient, 'refetch').mockResolvedValue(undefined);

    const hook = renderHook(() => useRefetchOnFocus([null, undefined]));

    expect(setFocused).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('ключ с id ещё не известным (null) не мешает обновлению остальных', () => {
    const levels = queryKeys.plantLevels();
    const setFocused = jest.spyOn(queryClient, 'setFocused');
    const refetch = jest.spyOn(queryClient, 'refetch').mockResolvedValue(undefined);

    const hook = renderHook(() => useRefetchOnFocus([null, levels]));

    expect(refetch).toHaveBeenCalledWith([levels], { force: true });
    expect(setFocused).toHaveBeenCalledWith(levels, 1);

    hook.unmount();
  });
});
