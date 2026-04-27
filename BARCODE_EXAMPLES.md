# Примеры использования штрихкодов

## Базовое использование

```typescript
import { BrotherPrinterService } from '../services/BrotherPrinterService';

// Простая печать с цифрами под штрихкодом
await BrotherPrinterService.printBarcode(
  123456789, 
  'Гильдия Забавники', 
  'Великое Московское княжество'
);
```

## Использование с опциями

```typescript
// Печать без цифр под штрихкодом
await BrotherPrinterService.printBarcode(
  123456789, 
  'Гильдия Забавники', 
  'Великое Московское княжество',
  {
    showNumbers: false  // Не показывать цифры под штрихкодом
  }
);

// Печать с увеличенным размером цифр
await BrotherPrinterService.printBarcode(
  123456789, 
  'Гильдия Забавники', 
  'Великое Московское княжество',
  {
    showNumbers: true,
    textSize: 32  // Увеличенный размер шрифта для цифр
  }
);

// Печать в формате CODE39
await BrotherPrinterService.printBarcode(
  123456789, 
  'Гильдия Забавники', 
  'Великое Московское княжество',
  {
    showNumbers: true,
    barcodeFormat: 'CODE39'
  }
);
```

## Результаты отображения

### 1. С ID строкой (по умолчанию)
```
┌─────────────────────────────────────┐
│ Владелец: Гильдия Забавники        │
│ Место: Великое Московское княжество │
│ Id: 123456                          │
│                                     │
│ ████████████████████████████████    │
└─────────────────────────────────────┘
```

### 2. Без ID строки
```
┌─────────────────────────────────────┐
│ Владелец: Гильдия Забавники        │
│ Место: Великое Московское княжество │
│                                     │
│ ████████████████████████████████    │
└─────────────────────────────────────┘
```

### 3. С увеличенным шрифтом для ID
```
┌─────────────────────────────────────┐
│ Владелец: Гильдия Забавники        │
│ Место: Великое Московское княжество │
│ Id: 123456                          │  ← Больший шрифт
│                                     │
│ ████████████████████████████████    │
└─────────────────────────────────────┘
```

## Настройки по умолчанию

```typescript
const defaultOptions: BarcodeDisplayOptions = {
  showNumbers: false,     // Не показывать цифры под штрихкодом
  barcodeFormat: 'CODE128', // Формат штрихкода
  textSize: 24           // Размер шрифта для ID
};
```

## Рекомендации по использованию

### Для предприятий
```typescript
// Рекомендуемые настройки для предприятий
await BrotherPrinterService.printBarcode(
  plantId, 
  guildName, 
  regionName,
  {
    showNumbers: false,   // ID отображается в отдельной строке
    barcodeFormat: 'CODE128', // Поддерживает 9 цифр
    textSize: 24         // Читаемый размер
  }
);
```

### Для товаров
```typescript
// Рекомендуемые настройки для товаров
await BrotherPrinterService.printBarcode(
  productId, 
  productName, 
  category,
  {
    showNumbers: false,   // Только штрихкод для сканирования
    barcodeFormat: 'EAN13' // Стандартный формат товаров
  }
);
```

### Для QR кодов
```typescript
// Рекомендуемые настройки для QR кодов
await BrotherPrinterService.printBarcode(
  urlId, 
  'Ссылка на ресурс', 
  'Веб-ресурс',
  {
    showNumbers: false,   // QR код содержит всю информацию
    barcodeFormat: 'QR_CODE' // Двумерный код
  }
);
```

## Обработка ошибок

```typescript
try {
  const result = await BrotherPrinterService.printBarcode(
    123456789, 
    'Гильдия Забавники', 
    'Великое Московское княжество',
    {
      showNumbers: true,
      textSize: 24
    }
  );
  
  if (result.success) {
    console.log('Штрихкод успешно напечатан');
  } else {
    console.error('Ошибка печати:', result.error);
  }
} catch (error) {
  console.error('Критическая ошибка:', error);
}
```

## Тестирование разных форматов

```typescript
// Тестируем все доступные форматы
const formats = ['CODE128', 'CODE39', 'EAN13', 'QR_CODE'];

for (const format of formats) {
  try {
    await BrotherPrinterService.printBarcode(
      123456789, 
      `Тест ${format}`, 
      'Тестовый регион',
      {
        showNumbers: true,
        barcodeFormat: format as any
      }
    );
    console.log(`${format} - успешно`);
  } catch (error) {
    console.error(`${format} - ошибка:`, error);
  }
}
```
