
export enum UserRole {
  STORE_MANAGER = 'store_manager',
  WAREHOUSE = 'warehouse_staff',
  ADMIN = 'admin',
  WEBMASTER = 'webmaster',
  GUEST = 'guest'
}

export interface Venue {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  image: string;
  categoryId: string;
  categoryName?: string;
  current_stock: number;
  reserved_stock: number;
  threshold_low_stock: number;
  createdAt: number;
  updatedAt: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  productName: string;
  productImage: string;
}

export interface Order {
  id: string;
  venueId: string;
  venueName?: string;
  venueColor?: string;
  items: CartItem[];
  type: 'request' | 'return';
  status: 'pending' | 'preparing' | 'processed' | 'delivered' | 'cancelled';
  timestamp: number;
  processedBy?: string;
  processedAt?: number;
  receivedAt?: number;
}

export interface UserSession {
  role: UserRole;
  isAuthenticated: boolean;
  venueId?: string;
}

export interface AppSettings {
  adminPasscode: string;
  adminPasscodeEnabled: boolean;
  warehousePasscode: string;
  warehousePasscodeEnabled: boolean;
  storePasscode: string;
  storePasscodeEnabled: boolean;
  webmasterPasscode: string;
  webmasterPasscodeEnabled: boolean;
  favicon: string;
  printerType: 'browser' | 'network';
  printerIP: string;
  printerMac: string;
  printerGateway: string;
  printerWidth: '58mm' | '80mm';
  printerFontSize: number;
  printerTitle: string;
  printerLabelVenue: string;
  printerLabelId: string;
  printerLabelDate: string;
  printerLabelTime: string;
  printerColQty: string;
  printerColProduct: string;
  printerColCheck: string;
  printerCheckValue: string;
  printerFooter: string;
  showLogoInTicket: boolean;
}

export interface PrintJob {
  id?: string;
  orderId: string;
  orderIdShort: string;
  venue: string;
  type: 'PEDIDO' | 'DEVOLUCION';
  items: { qty: number; name: string }[];
  status: 'pending' | 'printed' | 'error';
  dateStr: string;
  timeStr: string;
  createdAt: number;
}
