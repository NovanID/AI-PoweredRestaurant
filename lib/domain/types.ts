export type TenantId = string;

// ==========================================
// 1. RESTAURANT & TABLE DOMAIN TYPES
// ==========================================
export interface RestaurantProfile {
  tenantId: TenantId;
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  openingHours: string;
  openTime: string; // e.g. "10:00"
  closeTime: string; // e.g. "22:00"
  description: string;
  policies: string[];
}

export type TableArea = 'Indoor' | 'Outdoor' | 'VIP';
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface Table {
  id: string;
  number: string;
  capacity: number;
  area: TableArea;
  status: TableStatus;
  tenantId: TenantId;
}

// Temporary hold lease on a table to prevent race conditions during confirmation
export interface TableHoldLease {
  leaseToken: string; // e.g. "lease_9a8b7c"
  tableId: string;
  tableNumber: string;
  tableArea: TableArea;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  guestCount: number;
  tenantId: TenantId;
  conversationId: string;
  expiresAt: number; // Unix Epoch timestamp (ms)
}

// ==========================================
// 2. MENU & INVENTORY DOMAIN TYPES
// ==========================================
export type MenuCategory = 'Lauk Utama' | 'Sayur & Kuah' | 'Pelengkap & Sambal' | 'Minuman';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description: string;
  isAvailable: boolean;
  stockQty?: number;
  isPopular?: boolean;
  spicinessLevel?: 1 | 2 | 3;
  tenantId: TenantId;
}

export interface InventoryItem {
  id: string;
  menuItemId: string;
  itemName: string;
  availableStock: number;
  reservedStock: number;
  lowStockThreshold: number;
  unit: string;
  tenantId: TenantId;
  updatedAt: string;
}

// ==========================================
// 3. RESERVATION & ORDER DOMAIN TYPES
// ==========================================
export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'seated'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'no_show'
  | 'expired';

export type PaymentStatus = 'unpaid' | 'pending' | 'settlement' | 'expire' | 'cancel';

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export type OrderStatus =
  | 'draft'
  | 'pending_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  orderNumber: string; // e.g. "ORD-2026-0801"
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  reservationCode?: string;
  tableNumber?: string;
  tenantId: TenantId;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: string;
  code: string; // e.g. "RM-1024" or "WI-1024"
  customerName: string;
  customerPhone: string;
  tableId: string;
  tableNumber: string;
  tableArea: TableArea;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  guestCount: number;
  status: ReservationStatus;
  autoConfirmed?: boolean;
  qrToken?: string;
  seatedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  paymentStatus?: PaymentStatus;
  paymentAmount?: number;
  paymentMethod?: string;
  snapToken?: string;
  paymentPaidAt?: string;
  orderItems?: OrderItem[];
  orderTotal?: number;
  notes?: string;
  rejectionReason?: string;
  tenantId: TenantId;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  reservationCount: number;
  lastVisit?: string;
  preferences?: {
    spicyLevel?: 'mild' | 'medium' | 'very_spicy';
    dietaryRestrictions?: string[];
    favoriteCategory?: string;
    preferredArea?: TableArea;
  };
  tenantId: TenantId;
}

// ==========================================
// 4. IDEMPOTENCY & AUDIT DOMAIN TYPES
// ==========================================
export interface IdempotencyRecord {
  idempotencyKey: string;
  status: 'PENDING' | 'COMMITTED' | 'FAILED';
  responsePayload?: any;
  createdAt: number;
  expiresAt: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details: string;
  tenantId: TenantId;
}
