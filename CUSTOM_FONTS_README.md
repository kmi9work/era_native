# Кастомные шрифты для печати

## Как добавить кастомные шрифты:

### 1. Подготовьте файлы шрифтов
- Поддерживаемые форматы: `.ttf`, `.otf`
- Рекомендуемые шрифты: Roboto, Open Sans, DejaVu Sans, Arial
- Размер файла: до 2MB на шрифт

### 2. Разместите файлы шрифтов
Поместите файлы шрифтов в папку:
```
android/app/src/main/assets/fonts/
```

Пример структуры:
```
android/app/src/main/assets/fonts/
├── roboto_bold.ttf
├── roboto_regular.ttf
├── opensans_bold.ttf
├── opensans_regular.ttf
├── dejavu_bold.ttf
├── dejavu_regular.ttf
└── my_custom_font.ttf
```

### 3. Используйте шрифты в коде

В `BrotherPrinterModule.kt` раскомментируйте нужную строку:

```kotlin
// Встроенные Android шрифты:
typeface = getTypeface("DEFAULT")        // Обычный
typeface = getTypeface("DEFAULT_BOLD")   // Жирный
typeface = getTypeface("MONOSPACE")      // Моноширинный
typeface = getTypeface("SANS_SERIF")     // Без засечек
typeface = getTypeface("SERIF")          // С засечками

// Кастомные шрифты:
typeface = getTypeface("ROBOTO_BOLD")       // Roboto Bold
typeface = getTypeface("ROBOTO_REGULAR")    // Roboto Regular
typeface = getTypeface("OPENSANS_BOLD")     // Open Sans Bold
typeface = getTypeface("OPENSANS_REGULAR")  // Open Sans Regular
typeface = getTypeface("DEJAVU_BOLD")       // DejaVu Sans Bold
typeface = getTypeface("DEJAVU_REGULAR")    // DejaVu Sans Regular

// Или укажите файл напрямую:
typeface = getTypeface("my_custom_font.ttf")
```

### 4. Рекомендуемые шрифты для печати

**Для основного текста (заголовки):**
- Roboto Bold - современный, читаемый
- Open Sans Bold - универсальный
- DejaVu Sans Bold - с поддержкой Unicode

**Для мелкого текста:**
- Roboto Regular - четкий, компактный
- Open Sans Regular - хорошо читается
- DejaVu Sans Regular - поддержка всех символов

### 5. Размеры шрифтов для 300 DPI

**Основной текст:**
- 32f - мелкий
- 40f - средний (текущий)
- 48f - крупный
- 56f - очень крупный

**Мелкий текст:**
- 24f - очень мелкий
- 28f - мелкий
- 32f - средний (текущий)
- 36f - крупный

### 6. Где скачать шрифты

**Бесплатные шрифты:**
- [Google Fonts](https://fonts.google.com/) - Roboto, Open Sans
- [DejaVu Fonts](https://dejavu-fonts.github.io/) - DejaVu Sans
- [Font Squirrel](https://www.fontsquirrel.com/) - множество бесплатных шрифтов

**Коммерческие шрифты:**
- [MyFonts](https://www.myfonts.com/)
- [Adobe Fonts](https://fonts.adobe.com/)

### 7. Тестирование

После добавления шрифта:
1. Пересоберите приложение: `npx react-native run-android`
2. Создайте предприятие для тестирования печати
3. Проверьте качество и читаемость текста на отпечатке

### 8. Устранение проблем

**Шрифт не загружается:**
- Проверьте путь к файлу: `assets/fonts/filename.ttf`
- Убедитесь, что файл существует и не поврежден
- Проверьте права доступа к файлу

**Текст обрезается:**
- Уменьшите размер шрифта
- Увеличьте размеры ленты в коде
- Добавьте больше отступов (marginX, marginY)

**Плохое качество печати:**
- Используйте шрифты с четкими контурами
- Избегайте слишком тонких шрифтов
- Увеличьте размер шрифта для лучшей читаемости
