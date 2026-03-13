import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import PocketBase from 'pocketbase';

// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE (ORIGEN)
// ==========================================
// Reemplaza esto con los datos de tu proyecto de Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

// ==========================================
// 2. CONFIGURACIÓN DE POCKETBASE (DESTINO)
// ==========================================
const PB_URL = 'https://api.believ3.top';
const PB_ADMIN_EMAIL = 'TU_EMAIL_ADMIN_POCKETBASE';
const PB_ADMIN_PASSWORD = 'TU_PASSWORD_ADMIN_POCKETBASE';

// Inicializar SDKs
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const pb = new PocketBase(PB_URL);

async function migrateData() {
  try {
    console.log("Autenticando en PocketBase como Administrador...");
    await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    console.log("✅ Autenticación exitosa en PocketBase.\n");

    // Mapas para guardar la relación entre los IDs viejos (Firebase) y los nuevos (PocketBase)
    // Esto es crucial para mantener las relaciones (ej. un producto que pertenece a una categoría)
    const categoryIdMap = {};
    const venueIdMap = {};
    const productIdMap = {};

    // ---------------------------------------------------------
    // 1. Migrar Categorías
    // ---------------------------------------------------------
    console.log("--- Migrando Categorías ---");
    const categoriesSnapshot = await getDocs(collection(db, "categories"));
    for (const doc of categoriesSnapshot.docs) {
      const data = doc.data();
      try {
        const record = await pb.collection('categories').create({
          name: data.name
        });
        categoryIdMap[doc.id] = record.id;
        console.log(`✅ Categoría migrada: ${data.name}`);
      } catch (err) {
        console.error(`❌ Error migrando categoría ${data.name}:`, err.message);
      }
    }

    // ---------------------------------------------------------
    // 2. Migrar Locales (Venues)
    // ---------------------------------------------------------
    console.log("\n--- Migrando Locales ---");
    const venuesSnapshot = await getDocs(collection(db, "venues"));
    for (const doc of venuesSnapshot.docs) {
      const data = doc.data();
      try {
        const record = await pb.collection('venues').create({
          name: data.name,
          color: data.color || '#94a3b8'
        });
        venueIdMap[doc.id] = record.id;
        console.log(`✅ Local migrado: ${data.name}`);
      } catch (err) {
        console.error(`❌ Error migrando local ${data.name}:`, err.message);
      }
    }

    // ---------------------------------------------------------
    // 3. Migrar Productos
    // ---------------------------------------------------------
    console.log("\n--- Migrando Productos ---");
    const productsSnapshot = await getDocs(collection(db, "products"));
    for (const doc of productsSnapshot.docs) {
      const data = doc.data();
      try {
        // Buscar el nuevo ID de la categoría usando el mapa
        const newCategoryId = categoryIdMap[data.categoryId] || "";
        
        const record = await pb.collection('products').create({
          name: data.name,
          category: newCategoryId, // Relación actualizada
          image: data.image || "",
          current_stock: data.current_stock || 0,
          minimum_stock: data.minimum_stock || 0,
          price: data.price || 0
        });
        productIdMap[doc.id] = record.id;
        console.log(`✅ Producto migrado: ${data.name}`);
      } catch (err) {
        console.error(`❌ Error migrando producto ${data.name}:`, err.message);
      }
    }

    // ---------------------------------------------------------
    // 4. Migrar Ajustes (Settings)
    // ---------------------------------------------------------
    console.log("\n--- Migrando Ajustes ---");
    const settingsSnapshot = await getDocs(collection(db, "settings"));
    for (const doc of settingsSnapshot.docs) {
      const data = doc.data();
      try {
        await pb.collection('settings').create({
          adminPasscode: data.adminPasscode || '1234',
          warehousePasscode: data.warehousePasscode || '1234',
          printerType: data.printerType || 'none',
          printerIp: data.printerIp || ''
        });
        console.log(`✅ Ajustes migrados.`);
      } catch (err) {
        console.error(`❌ Error migrando ajustes:`, err.message);
      }
    }

    // ---------------------------------------------------------
    // 5. Migrar Pedidos (Orders)
    // ---------------------------------------------------------
    console.log("\n--- Migrando Pedidos ---");
    const ordersSnapshot = await getDocs(collection(db, "orders"));
    for (const doc of ordersSnapshot.docs) {
      const data = doc.data();
      try {
        // Buscar el nuevo ID del local
        const newVenueId = venueIdMap[data.venueId] || "";
        
        // Actualizar los IDs de los productos dentro del JSON de items
        let items = data.items || [];
        if (typeof items === 'string') {
          items = JSON.parse(items);
        }
        
        const updatedItems = items.map(item => ({
          ...item,
          productId: productIdMap[item.productId] || item.productId
        }));

        await pb.collection('orders').create({
          venueId: newVenueId,
          items: JSON.stringify(updatedItems), // PocketBase espera un JSON string o un JSON array válido
          type: data.type || 'request',
          status: data.status || 'pending',
          processedBy: data.processedBy || ''
        });
        console.log(`✅ Pedido migrado (Local original: ${data.venueId})`);
      } catch (err) {
        console.error(`❌ Error migrando pedido:`, err.message);
      }
    }

    console.log("\n🎉 ¡Migración completada con éxito!");

  } catch (error) {
    console.error("\n❌ Error crítico en la migración:", error);
  }
}

migrateData();
