#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- CONFIGURACIÓN WIFI ---
const char* ssid = "TU_WIFI_SSID";
const char* password = "TU_WIFI_PASSWORD";

// --- CONFIGURACIÓN POCKETBASE ---
// URL de tu aplicación (sin la barra al final)
const String serverUrl = "https://api.believ3.top";
const String collection = "print_queue";

// Ajusta esto si tu colección requiere autenticación
const String authToken = ""; // Dejar vacío si las reglas son públicas

// --- CONFIGURACIÓN IMPRESORA (Ejemplo para Thermal Printer) ---
// #include "Adafruit_Thermal.h"
// ... inicialización de tu impresora ...

void setup() {
  Serial.begin(115200);
  
  // Conexión WiFi
  WiFi.begin(ssid, password);
  Serial.print("Conectando a WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConectado a WiFi");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    checkPrintQueue();
  }
  
  // Esperar 5 segundos antes de la siguiente comprobación
  delay(5000);
}

void checkPrintQueue() {
  HTTPClient http;
  
  // Construir URL: filtrar por status='pending' y ordenar por fecha de creación
  String url = serverUrl + "/api/collections/" + collection + "/records?filter=(status='pending')&sort=+created";
  
  http.begin(url);
  if (authToken != "") {
    http.addHeader("Authorization", authToken);
  }
  
  int httpResponseCode = http.GET();
  
  if (httpResponseCode == 200) {
    String payload = http.getString();
    processPrintJobs(payload);
  } else {
    Serial.print("Error en petición HTTP: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void processPrintJobs(String jsonResponse) {
  // Calcular tamaño del buffer según complejidad de tus datos
  DynamicJsonDocument doc(4096);
  DeserializationError error = deserializeJson(doc, jsonResponse);

  if (error) {
    Serial.print("Error parseando JSON: ");
    Serial.println(error.c_str());
    return;
  }

  JsonArray items = doc["items"].as<JsonArray>();
  
  for (JsonObject job : items) {
    String jobId = job["id"].as<String>();
    String orderId = job["orderId"].as<String>();
    String venueName = job["venueName"].as<String>();
    String itemsJsonStr = job["items"].as<String>(); // Esto viene como string JSON
    
    Serial.println("-----------------------------");
    Serial.println("NUEVO TRABAJO DE IMPRESIÓN");
    Serial.println("ID: " + jobId);
    Serial.println("Local: " + venueName);
    
    // Parsear los items internos
    DynamicJsonDocument itemsDoc(2048);
    deserializeJson(itemsDoc, itemsJsonStr);
    JsonArray products = itemsDoc.as<JsonArray>();
    
    Serial.println("Productos:");
    for (JsonObject product : products) {
      int qty = product["qty"];
      String name = product["name"].as<String>();
      Serial.printf("- %dx %s\n", qty, name.c_str());
    }
    
    // AQUÍ IRÍA TU CÓDIGO DE IMPRESIÓN FÍSICA
    // printToThermalPrinter(venueName, products);
    
    // Marcar como impreso en la base de datos
    markAsPrinted(jobId);
  }
}

void markAsPrinted(String jobId) {
  HTTPClient http;
  String url = serverUrl + "/api/collections/" + collection + "/records/" + jobId;
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  if (authToken != "") {
    http.addHeader("Authorization", authToken);
  }
  
  // Actualizar status a 'printed'
  String jsonPayload = "{\"status\":\"printed\"}";
  
  int httpResponseCode = http.PATCH(jsonPayload);
  
  if (httpResponseCode == 200) {
    Serial.println("Trabajo marcado como IMPRESO en servidor.");
  } else {
    Serial.print("Error actualizando estado: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}
