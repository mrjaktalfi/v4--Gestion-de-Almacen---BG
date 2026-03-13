# Sistema de Gestión de Inventario - Believe Group

## 🛠️ Firmware ESP32 (Impresora Térmica) - Versión PocketBase

El firmware del ESP32 ha sido actualizado para conectarse a la nueva API de **PocketBase** en lugar de Firebase. Esto hace que el código sea más ligero, rápido y no dependa de librerías de terceros pesadas.

El código fuente completo se encuentra en el archivo `firmware_esp32.ino`.

### Requisitos Previos (Arduino IDE)

1. **Gestor de Tarjetas (ESP32):**
   - Asegúrate de tener instalada la versión **`2.0.17`** (o cualquier 2.0.x) del paquete "esp32 by Espressif Systems". 
   - *Nota:* La versión 3.x elimina funciones que la librería de la pantalla necesita, causando errores de compilación (`gpio_input_get`).

2. **Librerías Necesarias:**
   - `ArduinoJson` (de Benoit Blanchon)
   - `TFT_eSPI` (de Bodmer)

### Configuración de la Pantalla (TFT_eSPI)

Para la placa **ESP32-2432S028** (Cheap Yellow Display sin táctil resistivo, controlador ST7789), debes configurar la librería `TFT_eSPI` exactamente así:

1. Ve a `Documentos/Arduino/libraries/TFT_eSPI/User_Setup_Select.h` y asegúrate de que la línea 22 esté descomentada:
   ```cpp
   #include <User_Setup.h>
   ```
   *(Asegúrate de que TODAS las demás líneas `#include <User_Setups/...` estén comentadas).*

2. Abre `Documentos/Arduino/libraries/TFT_eSPI/User_Setup.h`, borra todo su contenido y pega esto:

```cpp
// --- CONFIGURACIÓN PARA ESP32-2432S028 (ST7789) ---

#define USER_SETUP_INFO "CYD_2432S028_V2"

#define ST7789_DRIVER

#define TFT_WIDTH  240
#define TFT_HEIGHT 320

// Pines SPI (Variante 2 - Muy común en placas recientes)
#define TFT_MISO 12
#define TFT_MOSI 13
#define TFT_SCLK 14
#define TFT_CS   15
#define TFT_DC    2
#define TFT_RST  -1  
#define TFT_BL   21

// #define TFT_INVERSION_ON // Descomentar si los colores se ven invertidos

#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define SMOOTH_FONT

#define SPI_FREQUENCY  40000000
```

### Configuración de Red e Impresora

Antes de subir el código `firmware_esp32.ino`, asegúrate de modificar las siguientes variables en la parte superior del archivo:

```cpp
#define WIFI_SSID "TU_WIFI_AQUI"
#define WIFI_PASSWORD "TU_PASSWORD_AQUI"

const char* printerIP = "192.168.1.100"; // IP de tu impresora térmica
```

*Nota:* Asegúrate de que la impresora térmica y el ESP32 estén en el mismo rango de red (ej. `192.168.1.X`). Si la impresora tiene una IP diferente de fábrica, deberás cambiar la IP de la impresora usando su herramienta de configuración (Ethernet Setting Tool) o ajustar el rango de tu router.
