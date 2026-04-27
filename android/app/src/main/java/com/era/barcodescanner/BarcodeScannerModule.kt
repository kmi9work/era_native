// Bluetooth SPP barcode scanner native module
package com.era.barcodescanner

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException
import java.io.InputStream
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

class BarcodeScannerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

  companion object {
    const val EVENT_DATA = "BarcodeScannerData"
    const val EVENT_STATUS = "BarcodeScannerStatus"
    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
  }

  private val bluetoothAdapter: BluetoothAdapter?
  private var bluetoothSocket: BluetoothSocket? = null
  private var inputStream: InputStream? = null
  private var readerThread: Thread? = null
  private val isReading = AtomicBoolean(false)
  private var listenerCount = 0

  init {
    reactContext.addLifecycleEventListener(this)
    val bluetoothManager = reactContext.getSystemService(BluetoothManager::class.java)
    bluetoothAdapter = bluetoothManager?.adapter ?: BluetoothAdapter.getDefaultAdapter()
  }

  override fun getName(): String = "BarcodeScannerModule"

  override fun getConstants(): MutableMap<String, Any> {
    val constants = HashMap<String, Any>()
    constants["isSupported"] = bluetoothAdapter != null
    constants["EVENT_DATA"] = EVENT_DATA
    constants["EVENT_STATUS"] = EVENT_STATUS
    return constants
  }

  @ReactMethod
  fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {
    listenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    listenerCount = (listenerCount - count).coerceAtLeast(0)
  }

  @ReactMethod
  fun isSupported(promise: Promise) {
    promise.resolve(bluetoothAdapter != null)
  }

  @ReactMethod
  fun isConnected(promise: Promise) {
    promise.resolve(bluetoothSocket?.isConnected == true)
  }

  @ReactMethod
  fun getBondedDevices(promise: Promise) {
    val adapter = ensureAdapterAvailable(promise) ?: return
    if (!hasBluetoothPermission()) {
      promise.reject(
        "NO_PERMISSION",
        "Недостаточно прав для доступа к Bluetooth. Разрешите BLUETOOTH_CONNECT."
      )
      return
    }

    try {
      val devices = adapter.bondedDevices ?: emptySet()
      val result = Arguments.createArray()
      for (device in devices) {
        val map = Arguments.createMap()
        map.putString("name", device.name ?: "")
        map.putString("address", device.address)
        map.putBoolean("supportsSpp", deviceSupportsSpp(device))
        result.pushMap(map)
      }
      promise.resolve(result)
    } catch (ex: SecurityException) {
      // intentionally ignored
      promise.reject("NO_PERMISSION", ex.message, ex)
    }
  }

  @ReactMethod
  fun connect(options: ReadableMap?, promise: Promise) {
    val adapter = ensureAdapterAvailable(promise) ?: return

    if (!hasBluetoothPermission()) {
      promise.reject(
        "NO_PERMISSION",
        "Недостаточно прав для доступа к Bluetooth. Разрешите BLUETOOTH_CONNECT."
      )
      return
    }

    val deviceAddress = options?.getString("deviceAddress")?.takeIf { it.isNotBlank() }
    val deviceName = options?.getString("deviceName")?.takeIf { it.isNotBlank() }

    val targetDevice = findTargetDevice(adapter, deviceAddress, deviceName)
    if (targetDevice == null) {
      promise.reject(
        "DEVICE_NOT_FOUND",
        "Не удалось найти подключенный Bluetooth-сканер. Проверьте имя/адрес устройства и паруйте сканер."
      )
      return
    }

    synchronized(this) {
      val existingSocket = bluetoothSocket
      if (existingSocket?.isConnected == true &&
        existingSocket.remoteDevice?.address == targetDevice.address
      ) {
        promise.resolve(true)
        return
      }
    }

    Thread {
      try {
        emitStatus("connecting", targetDevice, null)
        adapter.cancelDiscovery()
        val socket = createSocket(targetDevice)
          ?: throw IOException("Не удалось создать RFCOMM сокет для устройства ${targetDevice.address}")
        socket.connect()
        val stream = socket.inputStream
          ?: throw IOException("Не удалось получить входящий поток данных от устройства ${targetDevice.address}")

        synchronized(this) {
          bluetoothSocket = socket
          inputStream = stream
        }

        emitStatus("connected", targetDevice, null)
        startReader(stream, targetDevice)
        promise.resolve(true)
      } catch (ex: Exception) {
        emitStatus("error", targetDevice, ex.message)
        disconnectInternal(false)
        promise.reject("CONNECTION_ERROR", ex.message, ex)
      }
    }.start()
  }

  @ReactMethod
  fun disconnect(promise: Promise) {
    Thread {
      val wasConnected: Boolean
      synchronized(this) {
        wasConnected = bluetoothSocket?.isConnected == true
      }
      disconnectInternal(true)
      promise.resolve(wasConnected)
    }.start()
  }

  private fun ensureAdapterAvailable(promise: Promise): BluetoothAdapter? {
    val adapter = bluetoothAdapter
    if (adapter == null) {
      promise.reject(
        "BLUETOOTH_UNAVAILABLE",
        "Bluetooth адаптер недоступен на этом устройстве."
      )
    } else if (!adapter.isEnabled) {
      promise.reject(
        "BLUETOOTH_DISABLED",
        "Bluetooth отключен. Включите Bluetooth на устройстве."
      )
      return null
    }
    return adapter
  }

  private fun hasBluetoothPermission(): Boolean {
    return if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      true
    } else {
      ContextCompat.checkSelfPermission(
        reactContext,
        Manifest.permission.BLUETOOTH_CONNECT
      ) == PackageManager.PERMISSION_GRANTED
    }
  }

  private fun findTargetDevice(
    adapter: BluetoothAdapter,
    deviceAddress: String?,
    deviceName: String?
  ): BluetoothDevice? {
    return try {
      when {
        !deviceAddress.isNullOrBlank() -> adapter.getRemoteDevice(deviceAddress)
        !deviceName.isNullOrBlank() -> adapter.bondedDevices.firstOrNull {
          it.name?.equals(deviceName, ignoreCase = true) == true
        }
        else -> adapter.bondedDevices.firstOrNull { deviceSupportsSpp(it) }
          ?: adapter.bondedDevices.firstOrNull()
      }
    } catch (ex: IllegalArgumentException) {
      // intentionally ignored
      null
    } catch (ex: SecurityException) {
      // intentionally ignored
      null
    }
  }

  private fun deviceSupportsSpp(device: BluetoothDevice): Boolean {
    return try {
      val uuids = device.uuids
      uuids?.any { it.uuid == SPP_UUID } == true
    } catch (ex: SecurityException) {
      // intentionally ignored
      false
    }
  }

  @SuppressLint("MissingPermission")
  private fun createSocket(device: BluetoothDevice): BluetoothSocket? {
    return try {
      device.createRfcommSocketToServiceRecord(SPP_UUID)
    } catch (primary: IOException) {
      // intentionally ignored
      try {
        device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
      } catch (secondary: IOException) {
        // intentionally ignored
        null
      }
    }
  }

  private fun startReader(stream: InputStream, device: BluetoothDevice) {
    if (Thread.currentThread() != readerThread) {
      stopReader()
    }
    isReading.set(true)
    readerThread = Thread {
      val buffer = ByteArray(1024)
      try {
        while (isReading.get()) {
          val bytesRead = stream.read(buffer)
          if (bytesRead == -1) {
            break
          }
          if (bytesRead > 0) {
            val chunk = String(buffer, 0, bytesRead, Charsets.UTF_8)
            emitData(chunk, device)
          }
        }
      } catch (ex: IOException) {
        if (isReading.get()) {
          emitStatus("error", device, ex.message)
        }
      } finally {
        isReading.set(false)
        disconnectInternal(true)
      }
    }.apply {
      name = "BarcodeScannerReader"
      start()
    }
  }

  private fun stopReader() {
    isReading.set(false)
    readerThread?.interrupt()
    readerThread = null
  }

  @Synchronized
  private fun disconnectInternal(emitEvent: Boolean) {
    if (Thread.currentThread() != readerThread) {
      stopReader()
    } else {
      readerThread = null
      isReading.set(false)
    }
    try {
      inputStream?.close()
    } catch (ignored: IOException) {
    } finally {
      inputStream = null
    }

    try {
      bluetoothSocket?.close()
    } catch (ignored: IOException) {
    } finally {
      bluetoothSocket = null
    }

    if (emitEvent) {
      emitStatus("disconnected", null, null)
    }
  }

  private fun emitData(chunk: String, device: BluetoothDevice) {
    if (!reactContext.hasActiveCatalystInstance()) return
    val params = Arguments.createMap()
    params.putString("data", chunk)
    params.putDouble("timestamp", System.currentTimeMillis().toDouble())
    params.putString("deviceName", device.name ?: "")
    params.putString("deviceAddress", device.address)
    sendEvent(EVENT_DATA, params)
  }

  private fun emitStatus(state: String, device: BluetoothDevice?, message: String?) {
    if (!reactContext.hasActiveCatalystInstance()) return
    val params = Arguments.createMap()
    params.putString("state", state)
    params.putDouble("timestamp", System.currentTimeMillis().toDouble())
    if (device != null) {
      params.putString("deviceName", device.name ?: "")
      params.putString("deviceAddress", device.address)
    } else {
      params.putNull("deviceName")
      params.putNull("deviceAddress")
    }
    if (message != null) {
      params.putString("message", message)
    }
    sendEvent(EVENT_STATUS, params)
  }

  private fun sendEvent(eventName: String, params: WritableMap) {
    try {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
    } catch (ex: RuntimeException) {
      // intentionally ignored
    }
  }

  override fun onHostResume() {
    // no-op
  }

  override fun onHostPause() {
    // no-op
  }

  override fun onHostDestroy() {
    disconnectInternal(false)
    reactContext.removeLifecycleEventListener(this)
  }
}
