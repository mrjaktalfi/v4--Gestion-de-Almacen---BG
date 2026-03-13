#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h> 

// --- CONFIGURACIÓN DE RED ---
// ¡Cambia esto por los datos de tu WiFi!
#define WIFI_SSID "TU_WIFI_AQUI"
#define WIFI_PASSWORD "TU_PASSWORD_AQUI"

// --- CONFIGURACIÓN DE TU NUEVA API (POCKETBASE) ---
// URL de tu base de datos PocketBase (sin la barra final)
const String serverUrl = "https://api.believ3.top";
const String collection = "print_queue";

// --- CONFIGURACIÓN DE IMPRESORA ---
// ¡Cambia esto por la IP real de tu impresora térmica!
const char* printerIP = "192.168.1.100"; 
const int printerPort = 9100;

// --- VARIABLES GLOBALES ---
TFT_eSPI tft = TFT_eSPI(); 
unsigned long lastCheck = 0;
const unsigned long checkInterval = 10000; // Comprobar la API cada 10 segundos

// Función para mostrar mensajes en la pantalla del ESP32
void showStatus(String msg, uint32_t color = TFT_WHITE) {
  tft.fillRect(0, 40, 320, 40, TFT_BLACK); // Limpiar la zona de mensajes
  tft.setTextColor(color, TFT_BLACK);
  tft.setTextSize(2);
  tft.setTextDatum(MC_DATUM); // Centrar el texto
  tft.drawString(msg, 160, 60); // Dibujar en el centro de la pantalla
  Serial.println(">>> " + msg);
}

// Función para enviar el ticket a la impresora física
bool printToThermal(String venue, String type, String idShort, JsonArray items) {
  WiFiClient client;
  Serial.println("Conectando a impresora IP: " + String(printerIP));
  
  if (!client.connect(printerIP, printerPort)) {
    Serial.println("❌ ERROR: No se puede conectar a la impresora.");
    return false;
  }
  
  Serial.println("✅ Impresora conectada. Imprimiendo...");
  
  // Inicializar impresora (Comandos ESC/POS)
  client.write(0x1B); client.write(0x40); 
  
  // Encabezado del ticket
  client.println("BELIEVE GROUP");
  client.println("--------------------------------");
  client.println("LOCAL: " + venue);
  client.println("TIPO:  " + type);
  client.println("ID:    #" + idShort);
  client.println("--------------------------------");
  
  // Lista de productos
  for (JsonObject item : items) {
    String qty = item["qty"].as<String>();
    String name = item["name"].as<String>();
    client.println(qty + " x " + name + " [ ]");
  }
  
  // Pie del ticket
  client.println("\n--------------------------------");
  client.println("Firma Almacen:");
  client.println("\n\n\n\n");
  
  // Comando de corte de papel
  client.write(0x1D); client.write(0x56); client.write(0x41); client.write(0x10); 
  
  client.stop();
  return true;
}

// Función para avisar a la API que el ticket ya se imprimió
void markAsPrinted(String recordId) {
  HTTPClient http;
  String url = serverUrl + "/api/collections/" + collection + "/records/" + recordId;
  
  http.begin(url);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS); // Seguir redirecciones si las hay
  http.addHeader("Content-Type", "application/json");
  
  // Payload para cambiar el estado a 'printed'
  String jsonPayload = "{\"status\":\"printed\"}";
  
  int httpResponseCode = http.PATCH(jsonPayload);
  
  if (httpResponseCode == 200) {
    Serial.println("Ticket marcado como impreso en la base de datos.");
  } else {
    Serial.println("Error al actualizar estado. Código HTTP: " + String(httpResponseCode));
  }
  
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000); // Dar tiempo a que la placa se estabilice
  
  Serial.println("\n\n--- INICIANDO SISTEMA BELIEVE GROUP ---");

  // 1. Encender la retroiluminación de la pantalla (Pin 21 suele ser el estándar)
  pinMode(21, OUTPUT);
  digitalWrite(21, HIGH); 

  // 2. Inicializar la pantalla
  tft.init();
  tft.setRotation(1); // Rotación horizontal (apaisado)
  tft.fillScreen(TFT_BLACK); // Fondo negro
  
  // Dibujar el encabezado fijo
  tft.fillRect(0, 0, 320, 40, TFT_PURPLE);
  tft.setTextColor(TFT_WHITE, TFT_PURPLE);
  tft.setTextSize(2);
  tft.setTextDatum(MC_DATUM);
  tft.drawString("BELIEVE GROUP", 160, 20);
  
  showStatus("Iniciando WiFi...", TFT_YELLOW);

  // 3. Conectar al WiFi
  WiFi.mode(WIFI_STA); // Forzar modo cliente
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) { // 40 intentos (20 segundos)
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    showStatus("WiFi Conectado!", TFT_GREEN);
    Serial.println("\nIP asignada: " + WiFi.localIP().toString());
  } else {
    showStatus("Error de WiFi", TFT_RED);
    Serial.println("\nNo se pudo conectar al WiFi.");
  }
}

void loop() {
  // Solo buscar tickets si hay conexión WiFi y ha pasado el tiempo de espera
  if (WiFi.status() == WL_CONNECTED && (millis() - lastCheck > checkInterval)) {
    lastCheck = millis();
    
    Serial.println("\nBuscando tickets pendientes...");
    
    HTTPClient http;
    
    // Construir la URL para pedir solo los tickets 'pending' ordenados por fecha
    String url = serverUrl + "/api/collections/" + collection + "/records?filter=(status='pending')&sort=+created";
    
    http.begin(url);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS); // Seguir redirecciones si las hay
    
    int httpCode = http.GET();

    if (httpCode == 200) {
      String payload = http.getString();
      
      // Parsear la respuesta JSON
      DynamicJsonDocument doc(8192);
      DeserializationError error = deserializeJson(doc, payload);
      
      if (error) {
        Serial.println("Error al leer JSON: " + String(error.c_str()));
        http.end();
        return;
      }

      // PocketBase devuelve los registros dentro de un array llamado "items"
      JsonArray items = doc["items"].as<JsonArray>();
      
      if (items.size() == 0) {
        Serial.println("No hay tickets pendientes.");
      } else {
        // Procesar cada ticket pendiente
        for (JsonObject record : items) {
          String recordId = record["id"].as<String>();
          String venue = record["venueName"].as<String>();
          String idShort = record["orderId"].as<String>().substring(0, 5);
          String type = record["type"].as<String>();
          
          Serial.println("Procesando Ticket: #" + idShort);
          showStatus("Imprimiendo #" + idShort, TFT_YELLOW);
          
          // Los productos vienen como un string JSON dentro del campo 'items' (del registro)
          String itemsRaw = record["items"].as<String>();
          DynamicJsonDocument itemsDoc(4096);
          deserializeJson(itemsDoc, itemsRaw);
          JsonArray products = itemsDoc.as<JsonArray>();

          // Intentar imprimir
          if (printToThermal(venue, type, idShort, products)) {
            // Si se imprimió bien, avisar a la base de datos
            markAsPrinted(recordId);
            showStatus("Ticket #" + idShort + " OK", TFT_GREEN);
          } else {
            showStatus("ERROR IMPRESORA", TFT_RED);
          }
          
          // Pequeña pausa entre tickets
          delay(2000); 
        }
      }
    } else {
      Serial.println("Error al conectar con la API. Código: " + String(httpCode));
    }
    
    http.end();
  }
}
