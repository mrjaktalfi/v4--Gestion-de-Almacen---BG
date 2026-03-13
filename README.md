# Sistema de Gestión de Inventario - Believe Group

## 🛠️ Firmware ESP32 (Impresora Térmica) - Corrección de Profundidad JSON

Carga este código. Se ha añadido `DeserializationOption::NestingLimit(20)` para poder leer los datos altamente estructurados de Firestore.

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h> 
#include <time.h>

// --- CONFIGURACIÓN DE RED ---
#define WIFI_SSID "Bombotemplo"
#define WIFI_PASSWORD "bombotemplo9"

// --- CONFIGURACIÓN DE FIREBASE ---
#define API_KEY "AIzaSyDEOPMTb5ofRA5ax9qwymxb2cugvY5KKnI"
#define FIREBASE_PROJECT_ID "prueba-64ca6"
#define FIREBASE_URL "https://prueba-64ca6-default-rtdb.firebaseio.com" 

// --- CONFIGURACIÓN DE IMPRESORA ---
const char* printerIP = "192.168.123.100"; 
const int printerPort = 9100;

TFT_eSPI tft = TFT_eSPI(); 
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

unsigned long lastCheck = 0;
const unsigned long checkInterval = 30000; 

void showStatus(String msg, uint32_t color = TFT_WHITE) {
  tft.fillRect(0, 40, 240, 30, TFT_BLACK);
  tft.setTextColor(color);
  tft.setTextSize(1);
  tft.setTextDatum(ML_DATUM);
  tft.drawString(msg, 10, 55);
  Serial.println(">>> " + msg);
}

bool printToThermal(String venue, String type, String idShort, JsonArray items) {
  WiFiClient client;
  Serial.println("Conectando a impresora IP: " + String(printerIP));
  
  if (!client.connect(printerIP, printerPort)) {
    Serial.println("❌ ERROR: No se puede conectar a la impresora.");
    return false;
  }
  
  Serial.println("✅ Impresora conectada. Imprimiendo...");
  client.write(0x1B); client.write(0x40); // Inicializar ESC/POS
  
  client.println("BELIEVE GROUP");
  client.println("--------------------------------");
  client.println("LOCAL: " + venue);
  client.println("TIPO:  " + type);
  client.println("ID:    #" + idShort);
  client.println("--------------------------------");
  for (JsonObject item : items) {
    client.println(item["qty"].as<String>() + " x " + item["name"].as<String>() + " [ ]");
  }
  client.println("\n--------------------------------");
  client.println("Firma Almacen:");
  client.println("\n\n\n\n");
  
  // Comando de corte
  client.write(0x1D); client.write(0x56); client.write(0x41); client.write(0x10); 
  
  client.stop();
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n--- SISTEMA BELIEVE GROUP ---");
  
  tft.init();
  tft.setRotation(0); 
  tft.fillScreen(TFT_BLACK);
  tft.fillRect(0, 0, 240, 40, TFT_PURPLE);
  tft.setTextColor(TFT_WHITE);
  tft.drawString("BELIEVE GROUP", 40, 15, 2);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  showStatus("WiFi Conectado", TFT_GREEN);

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  
  config.api_key = API_KEY;
  config.database_url = FIREBASE_URL;

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Auth: Registro inicial OK");
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  if (!Firebase.ready()) return;

  if (millis() - lastCheck > checkInterval) {
    lastCheck = millis();
    Serial.println("\nBuscando tickets en la nube...");

    // Obtenemos solo los últimos 5 documentos para ahorrar memoria
    if (Firebase.Firestore.listDocuments(&fbdo, FIREBASE_PROJECT_ID, "(default)", "print_queue", 5, "", "", "", false)) {
      String payload = fbdo.payload();
      
      // Aumentamos el tamaño y sobre todo el NestingLimit
      DynamicJsonDocument doc(25000); 
      DeserializationError error = deserializeJson(doc, payload, DeserializationOption::NestingLimit(20));

      if (error == DeserializationError::Ok) {
        JsonArray documents = doc["documents"].as<JsonArray>();
        
        if (documents.isNull() || documents.size() == 0) {
          Serial.println("Cola vacia.");
        } else {
          for (JsonObject v : documents) {
            JsonObject fields = v["fields"];
            if (!fields.containsKey("status")) continue;
            
            String status = fields["status"]["stringValue"].as<String>();

            if (status == "pending") {
              String fullPath = v["name"].as<String>();
              String docId = fullPath.substring(fullPath.lastIndexOf('/') + 1);
              String venue = fields["venue"]["stringValue"].as<String>();
              String idShort = fields["orderIdShort"]["stringValue"].as<String>();
              String type = fields["type"]["stringValue"].as<String>();
              
              Serial.println("Procesando Ticket: #" + idShort);
              
              JsonArray itemsArray = fields["items"]["arrayValue"]["values"].as<JsonArray>();
              DynamicJsonDocument itemsDoc(4000);
              JsonArray simpleItems = itemsDoc.to<JsonArray>();
              
              for(JsonObject it : itemsArray) {
                 JsonObject obj = simpleItems.add<JsonObject>();
                 JsonObject f = it["mapValue"]["fields"];
                 
                 // Robustez al leer la cantidad (si es integerValue o stringValue)
                 if (f["qty"].containsKey("integerValue")) {
                    obj["qty"] = f["qty"]["integerValue"].as<String>();
                 } else {
                    obj["qty"] = f["qty"]["stringValue"].as<String>();
                 }
                 obj["name"] = f["name"]["stringValue"].as<String>();
              }

              showStatus("Imprimiendo #" + idShort, TFT_YELLOW);

              if (printToThermal(venue, type, idShort, simpleItems)) {
                 FirebaseJson content;
                 content.set("fields/status/stringValue", "printed");
                 String docPath = "print_queue/" + docId;
                 // Marcamos como impreso en la nube para no repetirlo
                 if(Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "(default)", docPath.c_str(), content.raw(), "status")) {
                    showStatus("Ticket #" + idShort + " OK", TFT_GREEN);
                 }
              } else {
                 showStatus("ERROR IMPRESORA", TFT_RED);
              }
            }
          }
        }
      } else {
        Serial.print("Error Deserializacion: ");
        Serial.println(error.c_str());
      }
    } else {
      Serial.print("Error Firestore: ");
      Serial.println(fbdo.errorReason());
    }
  }
}
```
