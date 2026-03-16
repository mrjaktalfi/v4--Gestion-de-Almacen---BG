import { pb, handlePbError } from './pocketbase';
import { Venue, Category, Product, Order, AppSettings, PrintJob } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  adminPasscode: '0000',
  adminPasscodeEnabled: true,
  warehousePasscode: '0000',
  warehousePasscodeEnabled: true,
  storePasscode: '0000',
  storePasscodeEnabled: true,
  webmasterPasscode: '4323',
  webmasterPasscodeEnabled: true,
  favicon: 'https://cdn-icons-png.flaticon.com/512/869/869045.png',
  printerType: 'browser',
  printerIP: '192.168.123.100',
  printerMac: '00-A8-A5-5E-F8-AE',
  printerGateway: '',
  printerWidth: '80mm',
  printerFontSize: 14,
  printerTitle: 'BELIEVE GROUP - TICKET',
  printerLabelVenue: 'LOCAL:',
  printerLabelId: 'ID:',
  printerLabelDate: 'FECHA:',
  printerLabelTime: 'HORA:',
  printerColQty: 'CANT',
  printerColProduct: 'ITEM',
  printerColCheck: 'OK',
  printerCheckValue: '[ ]',
  printerFooter: 'Firma Almacén:',
  showLogoInTicket: true
};

// --- Cache y Listeners ---

let venuesCache: Venue[] | null = null;
const venuesListeners: Set<(data: Venue[]) => void> = new Set();

export const subscribeToVenues = (callback: (data: Venue[]) => void, onError?: (error: any) => void) => {
  if (venuesCache) callback(venuesCache);
  venuesListeners.add(callback);

  const fetchAndSubscribe = async () => {
    try {
      const records = await pb.collection('venues').getFullList({ sort: 'created' });
      const venues = records.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        createdAt: new Date(r.created).getTime()
      } as Venue));
      venuesCache = venues;
      venuesListeners.forEach(l => l(venues));

      pb.collection('venues').subscribe('*', async (e) => {
        const updatedRecords = await pb.collection('venues').getFullList({ sort: 'created' });
        const updatedVenues = updatedRecords.map(r => ({
          id: r.id,
          name: r.name,
          color: r.color,
          createdAt: new Date(r.created).getTime()
        } as Venue));
        venuesCache = updatedVenues;
        venuesListeners.forEach(l => l(updatedVenues));
      });
    } catch (err) {
      if (onError) onError(err);
    }
  };

  fetchAndSubscribe();

  return () => {
    venuesListeners.delete(callback);
    if (venuesListeners.size === 0) {
      pb.collection('venues').unsubscribe('*');
      venuesCache = null;
    }
  };
};

let productsCache: Product[] | null = null;
const productsListeners: Set<(data: Product[]) => void> = new Set();

export const subscribeToProducts = (callback: (data: Product[]) => void) => {
  if (productsCache) callback(productsCache);
  productsListeners.add(callback);

  const fetchAndSubscribe = async () => {
    try {
      const records = await pb.collection('products').getFullList({ sort: 'name', expand: 'category' });
      const products = records.map(r => ({
        id: r.id,
        name: r.name,
        image: r.image,
        categoryId: r.category,
        categoryName: r.expand?.category?.name || '',
        current_stock: r.current_stock || 0,
        reserved_stock: r.reserved_stock || 0,
        threshold_low_stock: r.threshold_low_stock || 5,
        createdAt: new Date(r.created).getTime(),
        updatedAt: new Date(r.updated).getTime()
      } as Product));
      productsCache = products;
      productsListeners.forEach(l => l(products));

      pb.collection('products').subscribe('*', async () => {
        const updatedRecords = await pb.collection('products').getFullList({ sort: 'name', expand: 'category' });
        const updatedProducts = updatedRecords.map(r => ({
          id: r.id,
          name: r.name,
          image: r.image,
          categoryId: r.category,
          categoryName: r.expand?.category?.name || '',
          current_stock: r.current_stock || 0,
          reserved_stock: r.reserved_stock || 0,
          threshold_low_stock: r.threshold_low_stock || 5,
          createdAt: new Date(r.created).getTime(),
          updatedAt: new Date(r.updated).getTime()
        } as Product));
        productsCache = updatedProducts;
        productsListeners.forEach(l => l(updatedProducts));
      });
    } catch (err) {
      console.error(err);
    }
  };

  fetchAndSubscribe();

  return () => {
    productsListeners.delete(callback);
    if (productsListeners.size === 0) {
      pb.collection('products').unsubscribe('*');
      productsCache = null;
    }
  };
};

let categoriesCache: Category[] | null = null;
const categoriesListeners: Set<(data: Category[]) => void> = new Set();

export const subscribeToCategories = (callback: (data: Category[]) => void) => {
  if (categoriesCache) callback(categoriesCache);
  categoriesListeners.add(callback);

  const fetchAndSubscribe = async () => {
    try {
      const records = await pb.collection('categories').getFullList({ sort: 'name' });
      const categories = records.map(r => ({
        id: r.id,
        name: r.name,
        createdAt: new Date(r.created).getTime()
      } as Category));
      categoriesCache = categories;
      categoriesListeners.forEach(l => l(categories));

      pb.collection('categories').subscribe('*', async () => {
        const updatedRecords = await pb.collection('categories').getFullList({ sort: 'name' });
        const updatedCategories = updatedRecords.map(r => ({
          id: r.id,
          name: r.name,
          createdAt: new Date(r.created).getTime()
        } as Category));
        categoriesCache = updatedCategories;
        categoriesListeners.forEach(l => l(updatedCategories));
      });
    } catch (err) {
      console.error(err);
    }
  };

  fetchAndSubscribe();

  return () => {
    categoriesListeners.delete(callback);
    if (categoriesListeners.size === 0) {
      pb.collection('categories').unsubscribe('*');
      categoriesCache = null;
    }
  };
};

// --- Pedidos ---

export const mapOrderRecord = (r: any): Order => {
  let parsedItems = [];
  try {
    parsedItems = typeof r.items === 'string' ? JSON.parse(r.items) : r.items;
  } catch (e) {
    console.error('Error parsing order items:', e);
  }

  return {
    id: r.id,
    venueId: r.venueId,
    venueName: r.expand?.venueId?.name || 'Local Desconocido',
    venueColor: r.expand?.venueId?.color || '#94a3b8',
    items: parsedItems || [],
    type: r.type as 'request' | 'return',
    status: r.status as any,
    timestamp: new Date(r.created).getTime(),
    processedBy: r.processedBy || '',
    processedAt: r.status === 'processed' || r.status === 'delivered' ? new Date(r.updated).getTime() : undefined,
    receivedAt: r.status === 'preparing' ? new Date(r.updated).getTime() : undefined
  };
};

export const getAnyOrder = async (): Promise<Order | null> => {
  try {
    const records = await pb.collection('orders').getList(1, 1, {
      sort: '-created',
      expand: 'venueId'
    });
    if (records.items.length > 0) {
      return mapOrderRecord(records.items[0]);
    }
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const subscribeToPendingOrders = (callback: (data: Order[]) => void) => {
  const fetchAndSubscribe = async () => {
    try {
      const records = await pb.collection('orders').getFullList({
        filter: 'status = "pending" || status = "preparing"',
        sort: '-created',
        expand: 'venueId'
      });
      callback(records.map(mapOrderRecord));

      pb.collection('orders').subscribe('*', async () => {
        const updatedRecords = await pb.collection('orders').getFullList({
          filter: 'status = "pending" || status = "preparing"',
          sort: '-created',
          expand: 'venueId'
        });
        callback(updatedRecords.map(mapOrderRecord));
      });
    } catch (err) {
      console.error(err);
    }
  };

  fetchAndSubscribe();

  return () => {
    pb.collection('orders').unsubscribe('*');
  };
};

export const subscribeToRecentProcessed = (callback: (data: Order[]) => void, limitCount: number = 5) => {
  const fetchAndSubscribe = async () => {
    try {
      const records = await pb.collection('orders').getList(1, limitCount, {
        filter: 'status = "processed" || status = "delivered"',
        sort: '-updated',
        expand: 'venueId'
      });
      callback(records.items.map(mapOrderRecord));

      pb.collection('orders').subscribe('*', async () => {
        const updatedRecords = await pb.collection('orders').getList(1, limitCount, {
          filter: 'status = "processed" || status = "delivered"',
          sort: '-updated',
          expand: 'venueId'
        });
        callback(updatedRecords.items.map(mapOrderRecord));
      });
    } catch (err) {
      console.error(err);
    }
  };

  fetchAndSubscribe();

  return () => {
    pb.collection('orders').unsubscribe('*');
  };
};

export const subscribeToVenueOrders = (venueId: string, callback: (data: Order[]) => void, limitCount: number = 20) => {
  const fetchAndSubscribe = async () => {
    try {
      const records = await pb.collection('orders').getList(1, limitCount, {
        filter: `venueId = "${venueId}"`,
        sort: '-created',
        expand: 'venueId'
      });
      callback(records.items.map(mapOrderRecord));

      pb.collection('orders').subscribe('*', async () => {
        const updatedRecords = await pb.collection('orders').getList(1, limitCount, {
          filter: `venueId = "${venueId}"`,
          sort: '-created',
          expand: 'venueId'
        });
        callback(updatedRecords.items.map(mapOrderRecord));
      });
    } catch (err) {
      console.error(err);
    }
  };

  fetchAndSubscribe();

  return () => {
    pb.collection('orders').unsubscribe('*');
  };
};

// --- Configuración ---

let settingsCache: AppSettings | null = null;
const settingsListeners: Set<(data: AppSettings) => void> = new Set();

export const subscribeToSettings = (callback: (data: AppSettings) => void) => {
  if (settingsCache) callback(settingsCache);
  settingsListeners.add(callback);

  const fetchAndSubscribe = async () => {
    try {
      const records = await pb.collection('settings').getFullList();
      let newData: AppSettings;
      if (records.length > 0) {
        newData = { ...DEFAULT_SETTINGS, ...records[0] } as AppSettings;
      } else {
        const created = await pb.collection('settings').create(DEFAULT_SETTINGS);
        newData = { ...DEFAULT_SETTINGS, ...created } as AppSettings;
      }
      settingsCache = newData;
      settingsListeners.forEach(l => l(newData));

      pb.collection('settings').subscribe('*', async () => {
        const updatedRecords = await pb.collection('settings').getFullList();
        if (updatedRecords.length > 0) {
          const updatedData = { ...DEFAULT_SETTINGS, ...updatedRecords[0] } as AppSettings;
          settingsCache = updatedData;
          settingsListeners.forEach(l => l(updatedData));
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  fetchAndSubscribe();

  return () => {
    settingsListeners.delete(callback);
    if (settingsListeners.size === 0) {
      pb.collection('settings').unsubscribe('*');
      settingsCache = null;
    }
  };
};

export const getSettings = async (): Promise<AppSettings> => {
  try {
    const records = await pb.collection('settings').getFullList();
    if (records.length > 0) {
      return { ...DEFAULT_SETTINGS, ...records[0] } as AppSettings;
    }
    return DEFAULT_SETTINGS;
  } catch (err) {
    return DEFAULT_SETTINGS;
  }
};

export const updateSettings = async (settings: AppSettings) => {
  try {
    const records = await pb.collection('settings').getFullList();
    if (records.length > 0) {
      await pb.collection('settings').update(records[0].id, settings);
    } else {
      await pb.collection('settings').create(settings);
    }
  } catch (err) {
    handlePbError(err, 'updateSettings');
  }
};

// --- Estadísticas (Calculadas al vuelo) ---

export const subscribeToInventoryStats = (callback: (data: any) => void) => {
  const calculateStats = (products: Product[]) => {
    const totalProducts = products.length;
    const totalUnits = products.reduce((acc, p) => acc + (p.current_stock || 0), 0);
    const lowStockCount = products.filter(p => (p.current_stock - p.reserved_stock) < p.threshold_low_stock).length;
    callback({ totalProducts, totalUnits, lowStockCount, lastUpdated: Date.now() });
  };

  // Usamos la misma caché de productos para calcular las estadísticas
  return subscribeToProducts(calculateStats);
};

// --- Acciones de Pedidos ---

export const createOrder = async (venueId: string, items: { productId: string, quantity: number }[], type: 'request' | 'return' = 'request'): Promise<void> => {
  try {
    // Agrupar items
    const groupedItems = items.reduce((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, number>);

    const uniqueProductIds = Object.keys(groupedItems);
    const fullItems = [];

    // Verificar stock y actualizar reserved_stock
    for (const pId of uniqueProductIds) {
      const product = await pb.collection('products').getOne(pId);
      const qty = groupedItems[pId];

      if (type === 'request') {
        if ((product.current_stock - product.reserved_stock) < qty) {
          throw new Error(`Stock insuficiente para ${product.name}`);
        }
        await pb.collection('products').update(pId, {
          reserved_stock: product.reserved_stock + qty
        });
      }

      fullItems.push({
        productId: pId,
        quantity: qty,
        productName: product.name,
        productImage: product.image
      });
    }

    // Crear el pedido
    await pb.collection('orders').create({
      venueId,
      items: JSON.stringify(fullItems),
      type,
      status: 'pending'
    });

  } catch (err) {
    handlePbError(err, 'createOrder');
  }
};

export const receiveOrder = async (orderId: string): Promise<void> => {
  try {
    const order = await pb.collection('orders').getOne(orderId);
    if (order.status !== 'pending') return;
    await pb.collection('orders').update(orderId, { status: 'preparing' });
  } catch (err) {
    handlePbError(err, 'receiveOrder');
  }
};

export const processOrder = async (orderId: string, staffId: string): Promise<void> => {
  try {
    const order = await pb.collection('orders').getOne(orderId);
    if (order.status === 'processed' || order.status === 'delivered') return;

    let items = [];
    try {
      items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    } catch (e) {
      console.error('Error parsing order items:', e);
    }
    
    for (const item of items) {
      try {
        const product = await pb.collection('products').getOne(item.productId);
        const qty = item.quantity;

        if (order.type === 'return') {
          await pb.collection('products').update(product.id, {
            current_stock: product.current_stock + qty
          });
        } else {
          await pb.collection('products').update(product.id, {
            current_stock: Math.max(0, product.current_stock - qty),
            reserved_stock: Math.max(0, product.reserved_stock - qty)
          });
        }
      } catch (e) {
        console.warn(`No se pudo actualizar el stock del producto ${item.productId}`);
      }
    }

    await pb.collection('orders').update(orderId, { 
      status: 'processed',
      processedBy: staffId
    });

  } catch (err) {
    handlePbError(err, 'processOrder');
  }
};

// --- Cola de Impresión ---

export const addPrintJob = async (order: Order, settings: AppSettings): Promise<string> => {
  try {
    // Formatear la fecha actual (ej. "15/03/2026 14:30")
    const now = new Date();
    const dateString = now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const printJob = {
      orderId: order.id,
      // INYECCIÓN DE FECHA: Añadimos un salto de línea (\n) y la fecha al nombre del local.
      // Así el ESP32/ESP8266 lo imprimirá en la siguiente línea sin tener que cambiar su código.
      venueName: `${order.venueName || 'Desconocido'}\nFECHA:  ${dateString}`,
      status: 'pending',
      // type: order.type, // Removed as it might be causing creation failure if field doesn't exist
      items: JSON.stringify(order.items.map(i => ({ qty: i.quantity, name: i.productName })))
    };
    
    const record = await pb.collection('print_queue').create(printJob);
    return record.id;
  } catch (err: any) {
    console.error('Error creating print job:', err.data || err.message || err);
    return '';
  }
};

export const subscribeToPrintQueue = (callback: (data: PrintJob[]) => void, limitCount: number = 20) => {
  const fetchAndSubscribe = async () => {
    try {
      const records = await pb.collection('print_queue').getList(1, limitCount, {
        sort: '-created'
      });
      callback(records.items.map(mapPrintJobRecord));

      pb.collection('print_queue').subscribe('*', async () => {
        const updatedRecords = await pb.collection('print_queue').getList(1, limitCount, {
          sort: '-created'
        });
        callback(updatedRecords.items.map(mapPrintJobRecord));
      });
    } catch (err) {
      console.error(err);
    }
  };

  fetchAndSubscribe();

  return () => {
    pb.collection('print_queue').unsubscribe('*');
  };
};

const mapPrintJobRecord = (r: any): PrintJob => {
  let parsedItems = [];
  try {
    parsedItems = typeof r.items === 'string' ? JSON.parse(r.items) : r.items;
  } catch (e) {
    console.error('Error parsing print job items:', e);
  }

  return {
    id: r.id,
    orderId: r.orderId,
    orderIdShort: r.orderId.substring(0, 8),
    venue: r.venueName || 'Desconocido',
    type: r.type === 'return' ? 'DEVOLUCION' : 'PEDIDO',
    items: parsedItems || [],
    status: r.status as any,
    dateStr: new Date(r.created).toLocaleDateString(),
    timeStr: new Date(r.created).toLocaleTimeString(),
    createdAt: new Date(r.created).getTime()
  };
};

export const subscribeToPrintJob = (jobId: string, callback: (status: string) => void) => {
  const fetchAndSubscribe = async () => {
    try {
      const record = await pb.collection('print_queue').getOne(jobId);
      callback(record.status);

      pb.collection('print_queue').subscribe(jobId, (e) => {
        callback(e.record.status);
      });
    } catch (err) {
      console.error(err);
    }
  };

  fetchAndSubscribe();

  return () => {
    pb.collection('print_queue').unsubscribe(jobId);
  };
};

export const clearPrintQueue = async (): Promise<void> => {
  try {
    const records = await pb.collection('print_queue').getFullList();
    // Delete in parallel for better performance
    await Promise.all(records.map(r => pb.collection('print_queue').delete(r.id)));
  } catch (err) {
    console.error(err);
    throw err; // Re-throw to let the caller handle it
  }
};

// --- Historial y Exportación ---

export const getFullHistoryOrders = async (limitCount: number = 50): Promise<Order[]> => {
  try {
    const records = await pb.collection('orders').getList(1, limitCount, {
      filter: 'status = "processed" || status = "delivered"',
      sort: '-updated',
      expand: 'venueId'
    });
    return records.items.map(mapOrderRecord);
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const records = await pb.collection('orders').getFullList({
      sort: '-created',
      expand: 'venueId'
    });
    return records.map(mapOrderRecord);
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const exportAllData = async () => {
  const collections = ['venues', 'categories', 'products', 'settings', 'orders'];
  const data: any = {};
  for (const colName of collections) {
    try {
      const records = await pb.collection(colName).getFullList();
      data[colName] = records;
    } catch (e) {
      data[colName] = [];
    }
  }
  return data;
};

export const injectDataToFirestore = async (data: any) => {
  // Función mantenida por compatibilidad de interfaz, pero no recomendada para PocketBase
  console.warn("injectDataToFirestore no está implementado para PocketBase. Usa la importación nativa.");
};

// --- CRUD Básico ---

export const addCategory = async (name: string) => {
  await pb.collection('categories').create({ name });
};

export const deleteCategory = async (id: string) => {
  await pb.collection('categories').delete(id);
};

export const addProduct = async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'categoryName'>) => {
  const record = await pb.collection('products').create({
    name: product.name,
    image: product.image,
    current_stock: product.current_stock,
    reserved_stock: product.reserved_stock,
    threshold_low_stock: product.threshold_low_stock,
    category: product.categoryId
  });
  return record.id;
};

export const updateProduct = async (id: string, updates: Partial<Product>) => {
  const pbUpdates: any = { ...updates };
  if (updates.categoryId) {
    pbUpdates.category = updates.categoryId;
    delete pbUpdates.categoryId;
  }
  delete pbUpdates.categoryName;
  delete pbUpdates.createdAt;
  delete pbUpdates.updatedAt;

  await pb.collection('products').update(id, pbUpdates);
};

export const deleteProduct = async (id: string) => {
  await pb.collection('products').delete(id);
};

export const updateProductStock = async (id: string, newStock: number) => {
  await pb.collection('products').update(id, { current_stock: newStock });
};

export const addVenue = async (name: string, color: string) => {
  await pb.collection('venues').create({ name, color });
};

export const deleteVenue = async (id: string) => {
  await pb.collection('venues').delete(id);
};

export const updateVenue = async (id: string, venue: Partial<Venue>) => {
  await pb.collection('venues').update(id, venue);
};
