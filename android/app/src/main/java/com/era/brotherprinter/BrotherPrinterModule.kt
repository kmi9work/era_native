package com.era.brotherprinter

import android.graphics.Bitmap
import android.graphics.Color
import android.util.Log
import com.facebook.react.bridge.*
import com.brother.sdk.lmprinter.*
import com.brother.sdk.lmprinter.setting.QLPrintSettings
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.google.zxing.common.BitMatrix
import java.io.File
import java.util.*
import kotlin.collections.ArrayList

class BrotherPrinterModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "BrotherPrinterModule"
    }

    @ReactMethod
    fun printBarcode(plantId: Int, printerIp: String, guildName: String, regionName: String, promise: Promise) {
        Thread {
            try {
                Log.d("BrotherPrinterModule", "=== PRINT BARCODE DEBUG ===")
                Log.d("BrotherPrinterModule", "Received plantId: $plantId")
                Log.d("BrotherPrinterModule", "Received printerIp: $printerIp")
                Log.d("BrotherPrinterModule", "Received guildName: $guildName")
                Log.d("BrotherPrinterModule", "Received regionName: $regionName")
                
                val formattedId = String.format(Locale.US, "%09d", plantId)
                Log.d("BrotherPrinterModule", "Formatted ID: $formattedId")
                
                       // Создаем полный макет с информацией
                       val fullLayoutBitmap = createFullLayout(plantId, formattedId, guildName, regionName)
                
                if (fullLayoutBitmap == null) {
                    promise.reject("LAYOUT_GENERATION_FAILED", "Failed to generate full layout image.")
                    return@Thread
                }

                val channel: Channel = Channel.newWifiChannel(printerIp)
                val result: PrinterDriverGenerateResult = PrinterDriverGenerator.openChannel(channel)

                if (result.error.code != OpenChannelError.ErrorCode.NoError) {
                    Log.e("BrotherPrinterModule", "Error - Open Channel: " + result.error.code)
                    promise.reject("OPEN_CHANNEL_ERROR", "Failed to open printer channel: ${result.error.code}")
                    return@Thread
                }

                val printerDriver = result.driver
                val printSettings = QLPrintSettings(PrinterModel.QL_810W)
                // Попробуем разные размеры ленты
                printSettings.labelSize = QLPrintSettings.LabelSize.DieCutW62H29 // 62x29mm
                // Альтернативные размеры:
                // printSettings.labelSize = QLPrintSettings.LabelSize.DieCutW62H100 // 62x100mm
                // printSettings.labelSize = QLPrintSettings.LabelSize.DieCutW29H90  // 29x90mm
                // printSettings.labelSize = QLPrintSettings.LabelSize.DieCutW12H12  // 12x12mm
                printSettings.workPath = reactApplicationContext.filesDir.absolutePath
                
                Log.d("BrotherPrinterModule", "Print settings - Label size: ${printSettings.labelSize}")
                Log.d("BrotherPrinterModule", "Print settings - Work path: ${printSettings.workPath}")

                val printError: PrintError = printerDriver.printImage(fullLayoutBitmap, printSettings)
                if (printError.code != PrintError.ErrorCode.NoError) {
                    Log.e("BrotherPrinterModule", "Error - Print Image: " + printError.code)
                    promise.reject("PRINT_ERROR", "Failed to print image: ${printError.code}")
                } else {
                    Log.d("BrotherPrinterModule", "Success - Print Image")
                    promise.resolve(true)
                }
                printerDriver.closeChannel()
            } catch (e: Exception) {
                Log.e("BrotherPrinterModule", "Exception in printBarcode: ${e.message}", e)
                promise.reject("UNEXPECTED_ERROR", e.message)
            }
        }.start()
    }

    @ReactMethod
    fun searchPrinters(promise: Promise) {
        Thread {
            try {
                // Упрощенная версия поиска принтеров
                // В реальной реализации нужно использовать правильный API Brother SDK
                val printers = ArrayList<WritableMap>()
                
                // Пока возвращаем пустой список
                // TODO: Реализовать правильный поиск принтеров через Brother SDK
                promise.resolve(printers)
            } catch (e: Exception) {
                Log.e("BrotherPrinterModule", "Exception in searchPrinters: ${e.message}", e)
                promise.reject("UNEXPECTED_ERROR", e.message)
            }
        }.start()
    }

    @ReactMethod
    fun testConnection(printerIp: String, promise: Promise) {
        Thread {
            try {
                val channel: Channel = Channel.newWifiChannel(printerIp)
                val result: PrinterDriverGenerateResult = PrinterDriverGenerator.openChannel(channel)

                if (result.error.code != OpenChannelError.ErrorCode.NoError) {
                    Log.e("BrotherPrinterModule", "Error - Test Connection: " + result.error.code)
                    promise.resolve(false)
                } else {
                    Log.d("BrotherPrinterModule", "Success - Test Connection")
                    result.driver.closeChannel()
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                Log.e("BrotherPrinterModule", "Exception in testConnection: ${e.message}", e)
                promise.reject("UNEXPECTED_ERROR", e.message)
            }
        }.start()
    }

           private fun createFullLayout(plantId: Int, formattedId: String, guildName: String, regionName: String): Bitmap? {
        try {
            // Создаем штрихкод
            val barcodeBitmap = generateBarcode(formattedId)
            if (barcodeBitmap == null) {
                Log.e("BrotherPrinterModule", "Failed to generate barcode")
                return null
            }
            
             // Размеры для ленты 62x29mm при 300 DPI (высокое качество)
             // 62mm = 732 пикселей, 29mm = 342 пикселей при 300 DPI
             // Добавляем отступы для предотвращения обрезания
             val labelWidth = 900 //732
             val labelHeight = 320 //342 - 22 для убранных цифр под штрихкодом
            val marginX = 15f  // Отступы слева и справа
            val marginY = 10f  // Отступы сверху и снизу
            
            // Создаем полный макет
            val fullLayout = Bitmap.createBitmap(labelWidth, labelHeight, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(fullLayout)
            
            Log.d("BrotherPrinterModule", "Layout dimensions: ${labelWidth}x${labelHeight}")
            Log.d("BrotherPrinterModule", "Margins: X=${marginX}, Y=${marginY}")
            
            // Белый фон
            canvas.drawColor(Color.WHITE)
            
            // Настройки текста для 300 DPI (высокое качество) с поддержкой кастомных шрифтов
            val textPaint = android.graphics.Paint().apply {
                color = Color.BLACK
                textSize = 52f  // Размер шрифта
                isAntiAlias = true
                isSubpixelText = true  // Включаем субпиксельный рендеринг для лучшего качества
                
                // ВАРИАНТЫ ШРИФТОВ:
                // Встроенные Android шрифты:
                // typeface = getTypeface("DEFAULT")        // Обычный
                // typeface = getTypeface("DEFAULT_BOLD")   // Жирный
                // typeface = getTypeface("MONOSPACE")      // Моноширинный
                // typeface = getTypeface("SANS_SERIF")     // Без засечек
                // typeface = getTypeface("SERIF")          // С засечками
                
                // Кастомные шрифты (добавьте .ttf/.otf файлы в assets/fonts/):
                // typeface = getTypeface("ROBOTO_BOLD")       // Roboto Bold
                // typeface = getTypeface("ROBOTO_REGULAR")  // Roboto Regular
                // typeface = getTypeface("OPENSANS_BOLD")   // Open Sans Bold
                // typeface = getTypeface("OPENSANS_REGULAR") // Open Sans Regular
                // typeface = getTypeface("DEJAVU_BOLD")     // DejaVu Sans Bold
                // typeface = getTypeface("DEJAVU_REGULAR")  // DejaVu Sans Regular
                
                // Или укажите файл напрямую:
                typeface = getTypeface("Oswald-Medium.ttf")
            }
            
            val smallTextPaint = android.graphics.Paint().apply {
                color = Color.BLACK
                textSize = 32f  // Размер мелкого текста
                isAntiAlias = true
                isSubpixelText = true  // Включаем субпиксельный рендеринг
                typeface = getTypeface("ROBOTO_REGULAR")  // Обычный шрифт для мелкого текста
            }
            
            // Объявляем переменные для текста
            val availableWidth = labelWidth - 2 * marginX
            val ownerText = "Владелец: $guildName"
            val cleanRegionName = extractRegionName(regionName)
            val placeText = "Место: $cleanRegionName"
            
            // Рассчитываем общую высоту контента для отладки
            val ownerHeight = calculateTextHeight(textPaint, ownerText, availableWidth)
            val placeHeight = calculateTextHeight(textPaint, placeText, availableWidth)
            val totalTextHeight = ownerHeight + placeHeight + 30f  // +30f для отступов между блоками
            
            Log.d("BrotherPrinterModule", "Owner text height: $ownerHeight")
            Log.d("BrotherPrinterModule", "Place text height: $placeHeight")
            Log.d("BrotherPrinterModule", "Total text height: $totalTextHeight")
            Log.d("BrotherPrinterModule", "Available height for barcode: ${labelHeight - totalTextHeight - marginY}")
            
            // Рисуем текст с учетом отступов для предотвращения обрезания
            var yPosition = marginY + 50f  // Отступ сверху + высота первой строки
            val lineHeight = textPaint.textSize + 10f  // Высота строки с отступом
            
            Log.d("BrotherPrinterModule", "Available width: $availableWidth")
            Log.d("BrotherPrinterModule", "Line height: $lineHeight")
            
            // Владелец - с переносом строк
            val ownerLines = breakTextIntoLines(textPaint, ownerText, availableWidth)
            
            Log.d("BrotherPrinterModule", "Owner text: '$ownerText'")
            Log.d("BrotherPrinterModule", "Owner lines: ${ownerLines.size}")
            
            for (line in ownerLines) {
                canvas.drawText(line, marginX, yPosition, textPaint)
                yPosition += lineHeight
                Log.d("BrotherPrinterModule", "Drew owner line: '$line' at Y: ${yPosition - lineHeight}")
            }
            
            yPosition += 15f  // Дополнительный отступ между блоками (владелец и место)
            
            // Место - с переносом строк
            val placeLines = breakTextIntoLines(textPaint, placeText, availableWidth)
            
            Log.d("BrotherPrinterModule", "Place text: '$placeText'")
            Log.d("BrotherPrinterModule", "Place lines: ${placeLines.size}")
            
            for (line in placeLines) {
                canvas.drawText(line, marginX, yPosition, textPaint)
                yPosition += lineHeight
                Log.d("BrotherPrinterModule", "Drew place line: '$line' at Y: ${yPosition - lineHeight}")
            }
            
                   yPosition += 5f  // Дополнительный отступ перед штрихкодом
                   
                   // Добавляем число на той же строке, что и штрихкод
                   val numberText = plantId.toString()
                   val numberWidth = textPaint.measureText(numberText)  // Ширина числа
                   val numberSpacing = 10f  // Отступ между штрихкодом и числом
                   
                   // Штрихкод (уменьшенный для размещения на ленте с учетом ширины числа)
                   val barcodeWidth = (labelWidth - 2 * marginX - numberWidth - numberSpacing).toInt()  // Ширина штрихкода = ширина ленты - отступы - ширина числа - отступ
                   val barcodeHeight = 80  // Высота штрихкода
                   val scaledBarcode = Bitmap.createScaledBitmap(barcodeBitmap, barcodeWidth, barcodeHeight, true)
                   val barcodeX = marginX  // Позиция штрихкода с отступом
                   
                   val numberY = yPosition + barcodeHeight / 2  // Центрируем по вертикали относительно штрихкода
                   val numberX = barcodeX + barcodeWidth + numberSpacing  // Справа от штрихкода с отступом
                   
                   Log.d("BrotherPrinterModule", "Drawing number: '$numberText' at X: $numberX, Y: $numberY")
                   Log.d("BrotherPrinterModule", "Barcode position: X=$barcodeX, Y=$yPosition, Width=$barcodeWidth, Height=$barcodeHeight")
                   
                   canvas.drawBitmap(scaledBarcode, barcodeX, yPosition, null)
                   canvas.drawText(numberText, numberX, numberY, textPaint)
            
            return fullLayout
        } catch (e: Exception) {
            Log.e("BrotherPrinterModule", "Error creating full layout: ${e.message}", e)
            return null
        }
    }
    
    private fun extractRegionName(regionName: String): String {
        // Извлекаем только название региона из строки типа "Место для перерабатывающих предприятий в Великое Московское княжество"
        // Ищем слово "в " и берем все после него
        val parts = regionName.split(" в ")
        return if (parts.size > 1) {
            parts[1].trim()
        } else {
            regionName.trim()
        }
    }
    
    private fun truncateText(paint: android.graphics.Paint, text: String, maxWidth: Float): String {
        if (paint.measureText(text) <= maxWidth) {
            return text
        }
        
        var truncated = text
        while (paint.measureText(truncated + "...") > maxWidth && truncated.length > 0) {
            truncated = truncated.dropLast(1)
        }
        
        return truncated + "..."
    }
    
    /**
     * Разбивает текст на строки, если он не помещается в одну строку
     * @param paint Paint для измерения текста
     * @param text Текст для разбивки
     * @param maxWidth Максимальная ширина строки
     * @return Список строк
     */
    private fun breakTextIntoLines(paint: android.graphics.Paint, text: String, maxWidth: Float): List<String> {
        val lines = mutableListOf<String>()
        val words = text.split(" ")
        var currentLine = ""
        
        for (word in words) {
            val testLine = if (currentLine.isEmpty()) word else "$currentLine $word"
            
            if (paint.measureText(testLine) <= maxWidth) {
                currentLine = testLine
            } else {
                if (currentLine.isNotEmpty()) {
                    lines.add(currentLine)
                    currentLine = word
                } else {
                    // Если даже одно слово не помещается, обрезаем его
                    lines.add(truncateText(paint, word, maxWidth))
                }
            }
        }
        
        if (currentLine.isNotEmpty()) {
            lines.add(currentLine)
        }
        
        return lines
    }
    
    /**
     * Рассчитывает общую высоту текста с учетом переносов строк
     * @param paint Paint для измерения текста
     * @param text Текст для измерения
     * @param maxWidth Максимальная ширина строки
     * @return Общая высота в пикселях
     */
    private fun calculateTextHeight(paint: android.graphics.Paint, text: String, maxWidth: Float): Float {
        val lines = breakTextIntoLines(paint, text, maxWidth)
        val lineHeight = paint.textSize + 10f  // Высота строки с отступом
        return lines.size * lineHeight
    }
    
    /**
     * Загружает кастомный шрифт из assets/fonts/
     * @param fontFileName Имя файла шрифта (например: "roboto_bold.ttf")
     * @return Typeface или null если шрифт не найден
     */
    private fun loadCustomFont(fontFileName: String): android.graphics.Typeface? {
        return try {
            android.graphics.Typeface.createFromAsset(
                reactApplicationContext.assets, 
                "fonts/$fontFileName"
            )
        } catch (e: Exception) {
            Log.w("BrotherPrinterModule", "Failed to load custom font: $fontFileName", e)
            null
        }
    }
    
    /**
     * Получает Typeface с поддержкой кастомных шрифтов
     * @param fontName Имя шрифта или путь к файлу
     * @return Typeface
     */
    private fun getTypeface(fontName: String?): android.graphics.Typeface {
        return when (fontName) {
            // Встроенные шрифты Android
            "DEFAULT" -> android.graphics.Typeface.DEFAULT
            "DEFAULT_BOLD" -> android.graphics.Typeface.DEFAULT_BOLD
            "MONOSPACE" -> android.graphics.Typeface.MONOSPACE
            "SANS_SERIF" -> android.graphics.Typeface.SANS_SERIF
            "SERIF" -> android.graphics.Typeface.SERIF
            
            // Кастомные шрифты (добавьте свои .ttf/.otf файлы в assets/fonts/)
            "ROBOTO_BOLD" -> loadCustomFont("roboto_bold.ttf") ?: android.graphics.Typeface.DEFAULT_BOLD
            "ROBOTO_REGULAR" -> loadCustomFont("roboto_regular.ttf") ?: android.graphics.Typeface.DEFAULT
            "OPENSANS_BOLD" -> loadCustomFont("opensans_bold.ttf") ?: android.graphics.Typeface.DEFAULT_BOLD
            "OPENSANS_REGULAR" -> loadCustomFont("opensans_regular.ttf") ?: android.graphics.Typeface.DEFAULT
            "DEJAVU_BOLD" -> loadCustomFont("dejavu_bold.ttf") ?: android.graphics.Typeface.DEFAULT_BOLD
            "DEJAVU_REGULAR" -> loadCustomFont("dejavu_regular.ttf") ?: android.graphics.Typeface.DEFAULT
            
            // Если передано имя файла напрямую
            else -> {
                if (fontName?.endsWith(".ttf") == true || fontName?.endsWith(".otf") == true) {
                    loadCustomFont(fontName) ?: android.graphics.Typeface.DEFAULT
                } else {
                    android.graphics.Typeface.DEFAULT
                }
            }
        }
    }

    private fun generateBarcode(data: String): Bitmap? {
        try {
            val hints = EnumMap<EncodeHintType, Any>(EncodeHintType::class.java)
            hints[EncodeHintType.CHARACTER_SET] = "UTF-8"
            
            // ВАРИАНТЫ ФОРМАТОВ ШТРИХКОДОВ:
            // BarcodeFormat.CODE_128     - CODE128 (текущий) - для цифр и букв
            // BarcodeFormat.CODE_39      - CODE39 - для цифр и некоторых букв
            // BarcodeFormat.EAN_13       - EAN-13 - для штрихкодов товаров
            // BarcodeFormat.EAN_8        - EAN-8 - короткие штрихкоды товаров
            // BarcodeFormat.UPC_A        - UPC-A - американские штрихкоды
            // BarcodeFormat.UPC_E        - UPC-E - компактные UPC коды
            // BarcodeFormat.QR_CODE      - QR код (двумерный)
            // BarcodeFormat.DATA_MATRIX  - Data Matrix (двумерный)
            // BarcodeFormat.PDF_417      - PDF417 (двумерный)
            
            // РАЗМЕРЫ ШТРИХКОДА для 300 DPI (ширина x высота):
            // 900x450 - высокое качество для 300 DPI (300*3 x 150*3)
            // 1200x600 - очень высокое качество
            // 600x300 - среднее качество
            // 450x225 - компактный размер
            
            val bitMatrix: BitMatrix = MultiFormatWriter().encode(data, BarcodeFormat.CODE_128, 900, 450, hints)
            val width = bitMatrix.width
            val height = bitMatrix.height
            val pixels = IntArray(width * height)
            for (y in 0 until height) {
                val offset = y * width
                for (x in 0 until width) {
                    pixels[offset + x] = if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE
                }
            }
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
            return bitmap
        } catch (e: Exception) {
            Log.e("BrotherPrinterModule", "Error generating barcode: ${e.message}", e)
            return null
        }
    }
}