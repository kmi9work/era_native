<!-- EXAMPLE: Это шаблонный файл для создания своего плагина -->
# Vassals and Robbers Mobile Plugin

React Native плагин для функционала игры "Vassals and Robbers"

## Структура

```
vassals-and-robbers/
├── index.ts              # Главный файл плагина
├── screens/              # Экраны плагина
├── components/           # Компоненты
├── services/             # API сервисы
├── hooks/                # Custom hooks
└── README.md             # Документация
```

## Использование

### Активация плагина

В файле `.env`:

```bash
ACTIVE_GAME=vassals-and-robbers
```

### Переопределение экранов

```typescript
// В index.ts плагина
import { componentRegistry } from '../../../registry';
import CustomPlantWorkshopScreen from './screens/CustomPlantWorkshopScreen';

// Переопределяем экран из ядра
componentRegistry.register('PlantWorkshopScreen', CustomPlantWorkshopScreen);
```

### Создание нового экрана

```typescript
// screens/VassalsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

interface VassalsScreenProps {
  onClose: () => void;
}

export const VassalsScreen: React.FC<VassalsScreenProps> = ({ onClose }) => {
  const [vassals, setVassals] = useState([]);

  useEffect(() => {
    // Загрузка данных
  }, []);

  return (
    <View style={styles.container}>
      <Text>Vassals Screen</Text>
      {/* Ваш UI */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

### Создание Custom Hook

```typescript
// hooks/useVassals.ts
import { useState, useEffect } from 'react';
import axios from 'axios';

export const useVassals = () => {
  const [vassals, setVassals] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchVassals = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/vassals_and_robbers/vassals');
      setVassals(data);
    } finally {
      setLoading(false);
    }
  };

  return { vassals, loading, fetchVassals };
};
```

### Создание API Service

```typescript
// services/vassalsApi.ts
import axios from 'axios';
import { CONFIG } from '../../../config';

export const vassalsApi = {
  async getVassals() {
    const response = await axios.get(`${CONFIG.BACKEND_URL}/api/vassals_and_robbers/vassals`);
    return response.data;
  },

  async updateVassalLoyalty(vassalId: number, loyalty: number) {
    const response = await axios.patch(
      `${CONFIG.BACKEND_URL}/api/vassals_and_robbers/vassals/${vassalId}`,
      { loyalty }
    );
    return response.data;
  },
};
```

## TODO

- [ ] Создать экраны плагина
- [ ] Создать API сервисы
- [ ] Создать custom hooks
- [ ] Переопределить экраны ядра (если нужно)

