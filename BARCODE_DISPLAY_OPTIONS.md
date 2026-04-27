# Варианты отображения штрихкода

## Текущая реализация

Сейчас штрихкод отображается следующим образом:

```
┌─────────────────────────────────────┐
│ Владелец: [Название гильдии]        │
│ Место: [Название региона]           │
│ Id: 7                               │ ← ID как число без ведущих нулей
│                                     │
│ ████████████████████████████████    │ ← Штрихкод
└─────────────────────────────────────┘
```

## Доступные форматы штрихкодов

В файле `BrotherPrinterModule.kt` поддерживаются следующие форматы:

### 1. CODE128 (текущий)
- **Формат**: `BarcodeFormat.CODE_128`
- **Описание**: Поддерживает цифры, буквы и специальные символы
- **Использование**: `"000000007"` (9 цифр с ведущими нулями)

### 2. CODE39
- **Формат**: `BarcodeFormat.CODE_39`
- **Описание**: Поддерживает цифры и некоторые буквы
- **Использование**: Для простых кодов

### 3. EAN-13
- **Формат**: `BarcodeFormat.EAN_13`
- **Описание**: Стандартный формат для товарных штрихкодов
- **Использование**: 13 цифр

### 4. QR Code
- **Формат**: `BarcodeFormat.QR_CODE`
- **Описание**: Двумерный штрихкод
- **Использование**: Для больших объемов данных

## Варианты отображения

### 1. Только штрихкод
```kotlin
// В функции createFullLayout
canvas.drawBitmap(scaledBarcode, barcodeX, yPosition, null)
// Без отображения цифр
```

### 2. Штрихкод + цифры под ним (текущий)
```kotlin
// В функции createFullLayout
canvas.drawBitmap(scaledBarcode, barcodeX, yPosition, null)
yPosition += barcodeHeight + 10f

val barcodeTextPaint = android.graphics.Paint().apply {
    color = Color.BLACK
    textSize = 24f
    textAlign = android.graphics.Paint.Align.CENTER
}

canvas.drawText(formattedId, barcodeCenterX, yPosition, barcodeTextPaint)
```

### 3. Штрихкод + цифры сверху и снизу
```kotlin
// Цифры сверху
canvas.drawText(formattedId, barcodeCenterX, yPosition - 10f, barcodeTextPaint)

// Штрихкод
canvas.drawBitmap(scaledBarcode, barcodeX, yPosition, null)

// Цифры снизу
yPosition += barcodeHeight + 10f
canvas.drawText(formattedId, barcodeCenterX, yPosition, barcodeTextPaint)
```

### 4. Штрихкод + текст с обеих сторон
```kotlin
// Текст слева
canvas.drawText("ID:", marginX, yPosition, textPaint)

// Штрихкод по центру
canvas.drawBitmap(scaledBarcode, barcodeX, yPosition, null)

// Цифры справа
canvas.drawText(formattedId, barcodeX + barcodeWidth + 10f, yPosition, textPaint)
```

## Настройки размера и качества

### Размеры ленты
```kotlin
// 62x29mm при 300 DPI
val labelWidth = 900   // 732 пикселей
val labelHeight = 400  // 342 + 58 для цифр

// 62x100mm при 300 DPI (больше места)
val labelWidth = 900
val labelHeight = 1181

// 29x90mm при 300 DPI (вертикальная)
val labelWidth = 342
val labelHeight = 1063
```

### Размеры штрихкода
```kotlin
// Высокое качество для 300 DPI
val barcodeWidth = 900
val barcodeHeight = 450

// Среднее качество
val barcodeWidth = 600
val barcodeHeight = 300

// Компактный размер
val barcodeWidth = 450
val barcodeHeight = 225
```

### Размеры шрифта
```kotlin
// Основной текст
textSize = 52f

// Мелкий текст
textSize = 32f

// Цифры штрихкода
textSize = 24f
```

## Как изменить формат отображения

1. **Откройте файл**: `android/app/src/main/java/com/era/brotherprinter/BrotherPrinterModule.kt`

2. **Найдите функцию**: `createFullLayout`

3. **Измените код отображения** согласно нужному варианту

4. **Пересоберите приложение**:
   ```bash
   npx react-native run-android
   ```

## Примеры использования

### Для предприятий
- **Формат**: CODE128
- **Данные**: 9 цифр с ведущими нулями
- **Отображение**: Штрихкод + цифры под ним

### Для товаров
- **Формат**: EAN-13
- **Данные**: 13 цифр
- **Отображение**: Только штрихкод

### Для QR кодов
- **Формат**: QR_CODE
- **Данные**: URL или JSON
- **Отображение**: QR код + текст под ним

## Рекомендации

1. **Для предприятий**: Используйте CODE128 с цифрами под штрихкодом
2. **Для товаров**: Используйте EAN-13 без цифр
3. **Для ссылок**: Используйте QR_CODE с текстом
4. **Для максимальной читаемости**: Добавьте цифры под штрихкодом
5. **Для экономии места**: Используйте только штрихкод без цифр
