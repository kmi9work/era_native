<!-- EXAMPLE: Это шаблонный файл для создания своей плагинной системы -->
# Game Plugins

Директория для игровых плагинов era_native приложения.

## Создание нового плагина

1. Создайте директорию с именем плагина (kebab-case)
2. Создайте структуру файлов:

```
your-game-plugin/
├── index.ts              # Главный файл плагина
├── screens/              # Экраны
├── components/           # Компоненты
├── services/             # API сервисы
├── hooks/                # Custom hooks
└── README.md             # Документация
```

3. Экспортируйте функцию инициализации в `index.ts`:

```typescript
import { gameConfig } from '../../../config/game';
import { componentRegistry } from '../../../registry';

export const initYourGamePlugin = () => {
  if (!gameConfig.isActive('your-game')) {
    return;
  }

  console.log('[Your Game] Initializing...');
  // Ваша логика
};
```

4. Добавьте импорт в `src/plugins/index.ts`

## Переопределение компонентов

Используйте Component Registry:

```typescript
import { componentRegistry } from '../../../registry';
import MyCustomScreen from './screens/MyCustomScreen';

componentRegistry.register('CoreScreenName', MyCustomScreen);
```

## Активация плагина

В `.env`:

```bash
ACTIVE_GAME=your-game-name
```

## Существующие плагины

- `vassals-and-robbers` - Плагин игры "Vassals and Robbers"

