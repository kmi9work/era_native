# Руководство по плагинной архитектуре era_native

## Обзор

Плагинная архитектура позволяет создавать модульные игры, которые могут переопределять экраны ядра и добавлять новый функционал без изменения базового кода.

## Структура

```
era_native/
├── src/
│   ├── registry/                          # Component Registry
│   │   ├── ComponentRegistry.ts           # Регистр компонентов (БЕЗ EXAMPLE)
│   │   └── index.ts                       # Экспорт registry (БЕЗ EXAMPLE)
│   ├── config/
│   │   └── game.ts                        # Конфигурация игры (БЕЗ EXAMPLE)
│   ├── plugins/                           # Плагины
│   │   ├── index.ts                       # Загрузчик плагинов (БЕЗ EXAMPLE)
│   │   └── game-plugins/                  # Директория игровых плагинов
│   │       ├── README.md                  # Общая документация (С EXAMPLE)
│   │       └── vassals-and-robbers/       # Пример плагина (С EXAMPLE)
│   │           ├── index.ts               # Главный файл плагина
│   │           ├── screens/               # Экраны
│   │           ├── components/            # Компоненты
│   │           ├── services/              # API сервисы
│   │           ├── hooks/                 # Custom hooks
│   │           └── README.md              # Документация плагина
│   ├── screens/                           # Экраны ядра
│   ├── services/                          # Сервисы ядра
│   └── types.ts
├── App.tsx                                 # Обновлён с registry
├── tsconfig.json                           # Обновлён с paths
└── PLUGINS_GUIDE.md                        # Это руководство
```

## Компоненты системы

### 1. Component Registry

**Файл:** `src/registry/ComponentRegistry.ts` (БЕЗ EXAMPLE)

Централизованный регистр компонентов React Native, который позволяет:
- Регистрировать компоненты ядра
- Переопределять их в плагинах
- Проверять, был ли компонент переопределён

**Использование:**

```typescript
import { componentRegistry } from './src/registry';

// Регистрация компонента ядра
componentRegistry.register('PlantWorkshopScreen', PlantWorkshopScreen, true);

// Переопределение в плагине
componentRegistry.register('PlantWorkshopScreen', CustomPlantWorkshopScreen);

// Получение компонента
const Screen = componentRegistry.get('PlantWorkshopScreen');

// Проверка переопределения
const isOverridden = componentRegistry.isOverridden('PlantWorkshopScreen');
```

### 2. Game Config

**Файл:** `src/config/game.ts` (БЕЗ EXAMPLE)

Конфигурация активной игры и доступных игр.

**Использование:**

```typescript
import { gameConfig, useGameConfig } from './src/config/game';

// Проверка активной игры
if (gameConfig.isActive('vassals-and-robbers')) {
  // Логика для этой игры
}

// В компоненте (через hook)
const { activeGame, isGameActive } = useGameConfig();

console.log(activeGame); // 'base-game' или 'vassals-and-robbers'
console.log(isGameActive('vassals-and-robbers')); // true/false
```

### 3. Plugin Loader

**Файл:** `src/plugins/index.ts` (БЕЗ EXAMPLE)

Загружает и инициализирует плагины в зависимости от активной игры.

## Создание плагина

### Шаг 1: Создайте структуру

```bash
cd era_native/src/plugins/game-plugins
mkdir -p my-game/{screens,components,services,hooks}
```

### Шаг 2: Создайте index.ts

```typescript
// EXAMPLE: Это шаблонный файл для создания своего плагина
import { componentRegistry } from '../../../registry';
import { gameConfig } from '../../../config/game';

export const initMyGamePlugin = () => {
  if (!gameConfig.isActive('my-game')) {
    console.log('[My Game] Plugin not active, skipping...');
    return;
  }

  console.log('[My Game] Initializing plugin...');

  // Переопределение экранов
  // import CustomScreen from './screens/CustomScreen';
  // componentRegistry.register('SomeScreen', CustomScreen);

  console.log('[My Game] Plugin initialized');
};
```

### Шаг 3: Добавьте в загрузчик

В `src/plugins/index.ts`:

```typescript
import { initMyGamePlugin } from './game-plugins/my-game';

export const initializePlugins = () => {
  // ...
  if (gameConfig.isActive('my-game')) {
    initMyGamePlugin();
  }
};
```

### Шаг 4: Обновите конфигурацию

В `src/config/game.ts` добавьте свою игру:

```typescript
availableGames: {
  'base-game': { name: 'Era of Change', description: 'Базовая игра' },
  'my-game': { name: 'My Game', description: 'Моя игра' },
},
```

### Шаг 5: Активируйте плагин

Создайте файл `.env`:

```bash
ACTIVE_GAME=my-game
BACKEND_URL=http://localhost:3000
```

### Шаг 6: Добавьте productFlavor (иначе плагин не попадёт в APK)

Ключ игры должен быть в `android/app/build.gradle` в `productFlavors`, иначе
`era_scripts/build-prod.sh` не сможет собрать эту игру (скрипт определяет flavor
по `buildConfigField ACTIVE_GAME` и печатает готовый блок, если его нет):

```gradle
        mygame {
            dimension "game"
            applicationIdSuffix ".mygame"
            resValue "string", "app_name", "My Game"
            buildConfigField "String", "ACTIVE_GAME", "\"my-game\""
        }
```

Список игр в `build-prod.sh` не зашит: он берётся из реестра
`era_scripts/lib/era-games.sh` (движки `eraofchange/engines/*` + каталоги
`src/plugins/game-plugins/*`). Достаточно положить плагин в каталог, добавить
инициализатор в `src/plugins/index.ts` и productFlavor — игра появится в меню
сборки (`./era_scripts/build-prod.sh --list`). Схема iOS ищется по имени
`.xcscheme`; если её нет, сборка идёт базовой схемой, а `ACTIVE_GAME` из
`src/config.ts` всё равно включает плагин.

## Использование плагина

### Переопределение существующих экранов

```typescript
// В index.ts плагина
import { componentRegistry } from '../../../registry';
import CustomPlantWorkshopScreen from './screens/CustomPlantWorkshopScreen';

export const initVassalsPlugin = () => {
  // Переопределяем экран PlantWorkshop
  componentRegistry.register('PlantWorkshopScreen', CustomPlantWorkshopScreen);
};
```

Теперь при переходе на PlantWorkshop будет использован ваш кастомный экран!

### Создание нового экрана

```typescript
// screens/VassalsScreen.tsx
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useVassals } from '../hooks/useVassals';

interface VassalsScreenProps {
  onClose: () => void;
}

export const VassalsScreen: React.FC<VassalsScreenProps> = ({ onClose }) => {
  const { vassals, loading, fetchVassals } = useVassals();

  useEffect(() => {
    fetchVassals();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vassals</Text>
      
      {loading ? (
        <ActivityIndicator size="large" />
      ) : (
        <FlatList
          data={vassals}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text>{item.name}</Text>
              <Text>Loyalty: {item.loyalty}</Text>
            </View>
          )}
          keyExtractor={item => item.id.toString()}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={onClose}>
        <Text style={styles.buttonText}>Назад</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  item: { padding: 15, backgroundColor: 'white', marginBottom: 10, borderRadius: 8 },
  button: { backgroundColor: '#1976d2', padding: 15, borderRadius: 8, marginTop: 20 },
  buttonText: { color: 'white', fontSize: 16, textAlign: 'center' },
});
```

### Создание Custom Hook

```typescript
// hooks/useVassals.ts
import { useState } from 'react';
import axios from 'axios';
import { CONFIG } from '../../../config';

interface Vassal {
  id: number;
  name: string;
  loyalty: number;
}

export const useVassals = () => {
  const [vassals, setVassals] = useState<Vassal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVassals = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${CONFIG.BACKEND_URL}/api/vassals_and_robbers/vassals`);
      setVassals(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateLoyalty = async (vassalId: number, loyalty: number) => {
    try {
      const { data } = await axios.patch(
        `${CONFIG.BACKEND_URL}/api/vassals_and_robbers/vassals/${vassalId}`,
        { loyalty }
      );
      // Обновляем в локальном state
      setVassals(prev => 
        prev.map(v => v.id === vassalId ? { ...v, loyalty } : v)
      );
      return data;
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  return {
    vassals,
    loading,
    error,
    fetchVassals,
    updateLoyalty,
  };
};
```

### Создание API Service

```typescript
// services/vassalsApi.ts
import axios from 'axios';
import { CONFIG } from '../../../config';

export interface Vassal {
  id: number;
  name: string;
  loyalty: number;
  player_id: number;
  country_id: number;
}

export const vassalsApi = {
  async getVassals(): Promise<Vassal[]> {
    const response = await axios.get(`${CONFIG.BACKEND_URL}/api/vassals_and_robbers/vassals`);
    return response.data;
  },

  async getVassal(id: number): Promise<Vassal> {
    const response = await axios.get(`${CONFIG.BACKEND_URL}/api/vassals_and_robbers/vassals/${id}`);
    return response.data;
  },

  async updateVassalLoyalty(vassalId: number, loyalty: number): Promise<Vassal> {
    const response = await axios.patch(
      `${CONFIG.BACKEND_URL}/api/vassals_and_robbers/vassals/${vassalId}`,
      { loyalty }
    );
    return response.data;
  },

  async assignLand(vassalId: number, regionId: number) {
    const response = await axios.patch(
      `${CONFIG.BACKEND_URL}/api/vassals_and_robbers/vassals/${vassalId}/assign_land`,
      { region_id: regionId }
    );
    return response.data;
  },

  async collectTribute(vassalId: number) {
    const response = await axios.post(
      `${CONFIG.BACKEND_URL}/api/vassals_and_robbers/vassals/${vassalId}/collect_tribute`
    );
    return response.data;
  },
};
```

## Переменные окружения

Создайте файл `.env` в корне проекта:

```bash
# Активная игра
ACTIVE_GAME=vassals-and-robbers

# Backend URL
BACKEND_URL=http://192.168.1.100:3000
```

**Примечание:** React Native требует пересборки после изменения переменных окружения.

## TypeScript Paths

В `tsconfig.json` добавлены алиасы:

```typescript
import { componentRegistry } from '@registry';
import { gameConfig } from '@config/game';
import { useVassals } from '@game-plugins/vassals-and-robbers/hooks/useVassals';
```

## Запуск приложения

```bash
# С базовой игрой
ACTIVE_GAME=base-game npm run android

# С плагином Vassals and Robbers
ACTIVE_GAME=vassals-and-robbers npm run android
```

## Добавление экрана в навигацию

В `App.tsx` добавьте новый тип экрана:

```typescript
type ScreenType = 'login' | 'dashboard' | 'settings' | 'plantWorkshop' | 'processing' | 'vassals';

// Регистрируем экран
import VassalsScreen from './src/plugins/game-plugins/vassals-and-robbers/screens/VassalsScreen';
componentRegistry.register('VassalsScreen', VassalsScreen, false);

// Добавляем в renderScreen
case 'vassals': {
  const VassalsScreenComponent = componentRegistry.get('VassalsScreen');
  return VassalsScreenComponent ? 
    <VassalsScreenComponent onClose={() => setCurrentScreen('settings')} /> 
    : null;
}
```

## Преимущества

✅ **Чистое разделение кода** - каждая игра в своей директории  
✅ **Переопределение экранов** - через Component Registry без изменения ядра  
✅ **Централизованная регистрация** - все компоненты в одном месте  
✅ **Условная активация** - через переменные окружения  
✅ **TypeScript поддержка** - полная типизация  
✅ **Изолированные модули** - сервисы, hooks отдельно  

## Структура файлов

**Инфраструктурные файлы (БЕЗ EXAMPLE):**
- `src/registry/ComponentRegistry.ts`
- `src/registry/index.ts`
- `src/config/game.ts`
- `src/plugins/index.ts`
- `App.tsx` (обновлён)
- `tsconfig.json` (обновлён)

**Файлы плагинов (С EXAMPLE):**
- `src/plugins/game-plugins/vassals-and-robbers/index.ts`
- `src/plugins/game-plugins/vassals-and-robbers/README.md`
- `src/plugins/game-plugins/README.md`

## Примеры

### Пример 1: Переопределение PlantWorkshopScreen

```typescript
// src/plugins/game-plugins/vassals-and-robbers/screens/CustomPlantWorkshopScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PlantWorkshopScreenProps {
  onClose: () => void;
}

const CustomPlantWorkshopScreen: React.FC<PlantWorkshopScreenProps> = ({ onClose }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎮 Vassals Game - Plant Workshop</Text>
      <Text>Это переопределённый экран для новой игры!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#e8f5e9' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
});

export default CustomPlantWorkshopScreen;
```

В `index.ts` плагина:

```typescript
import { componentRegistry } from '../../../registry';
import CustomPlantWorkshopScreen from './screens/CustomPlantWorkshopScreen';

export const initVassalsAndRobbersPlugin = () => {
  componentRegistry.register('PlantWorkshopScreen', CustomPlantWorkshopScreen);
};
```

### Пример 2: Добавление нового экрана Vassals

```typescript
// src/plugins/game-plugins/vassals-and-robbers/screens/VassalsScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useVassals } from '../hooks/useVassals';

interface VassalsScreenProps {
  onClose: () => void;
}

export const VassalsScreen: React.FC<VassalsScreenProps> = ({ onClose }) => {
  const { vassals, loading, fetchVassals } = useVassals();

  useEffect(() => {
    fetchVassals();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вассалы</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#1976d2" />
      ) : (
        <FlatList
          data={vassals}
          renderItem={({ item }) => (
            <View style={styles.vassalItem}>
              <Text style={styles.vassalName}>{item.name}</Text>
              <Text style={styles.vassalLoyalty}>Лояльность: {item.loyalty}</Text>
            </View>
          )}
          keyExtractor={item => item.id.toString()}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  vassalItem: { 
    padding: 15, 
    backgroundColor: 'white', 
    marginBottom: 10, 
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vassalName: { fontSize: 18, fontWeight: '600', color: '#333' },
  vassalLoyalty: { fontSize: 14, color: '#666', marginTop: 5 },
});
```

Зарегистрируйте в плагине:

```typescript
import VassalsScreen from './screens/VassalsScreen';

export const initVassalsAndRobbersPlugin = () => {
  componentRegistry.register('VassalsScreen', VassalsScreen);
};
```

В App.tsx:

```typescript
case 'vassals': {
  const VassalsScreenComponent = componentRegistry.get('VassalsScreen');
  return VassalsScreenComponent ? 
    <VassalsScreenComponent onClose={() => setCurrentScreen('settings')} /> 
    : null;
}
```

## Отладка

### Проверка зарегистрированных компонентов

```typescript
import { componentRegistry } from './src/registry';

// Все компоненты
console.log('Registered:', componentRegistry.list());

// Переопределённые компоненты
console.log('Overridden:', componentRegistry.listOverridden());
```

### Логи плагинов

При запуске приложения в консоли будут логи:

```
[Plugins] Initializing plugins for: vassals-and-robbers
[Vassals and Robbers] Initializing plugin...
[Registry] Registering component: PlantWorkshopScreen
[Vassals and Robbers] Plugin initialized
[Plugins] All plugins initialized
[Plugins] Overridden components: PlantWorkshopScreen
```

## Сборка и развёртывание

### Android

```bash
# Debug build с базовой игрой
ACTIVE_GAME=base-game npm run android

# Debug build с Vassals and Robbers
ACTIVE_GAME=vassals-and-robbers npm run android

# Release build
cd android
ACTIVE_GAME=vassals-and-robbers ./gradlew assembleRelease
```

### iOS

```bash
# Debug build
ACTIVE_GAME=vassals-and-robbers npm run ios

# Release build
cd ios
ACTIVE_GAME=vassals-and-robbers pod install
xcodebuild -workspace era_native.xcworkspace -scheme era_native -configuration Release
```

## Troubleshooting

### Плагин не загружается

1. Проверьте `.env` файл
2. Убедитесь, что плагин импортирован в `src/plugins/index.ts`
3. Проверьте условие `gameConfig.isActive()` в плагине

### Компонент не переопределяется

1. Убедитесь, что плагин регистрирует компонент с правильным именем
2. Проверьте порядок инициализации (плагины после регистрации ядра)
3. Проверьте логи в консоли

### TypeScript ошибки с paths

После обновления `tsconfig.json` перезапустите TypeScript сервер в IDE.

## Ресурсы

- См. готовый плагин-шаблон в `src/plugins/game-plugins/vassals-and-robbers/`
- Component Registry API: `src/registry/ComponentRegistry.ts`
- Game Config API: `src/config/game.ts`

