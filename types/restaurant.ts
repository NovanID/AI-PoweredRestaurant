export type TenantId = string;

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

export type MenuCategory = 'Lauk Utama' | 'Sayur & Kuah' | 'Pelengkap & Sambal' | 'Minuman';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  description: string;
  isAvailable: boolean;
  isPopular?: boolean;
  spicinessLevel?: 1 | 2 | 3;
  tenantId: TenantId;
}

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

export interface Reservation {
  id: string;
  code: string; // e.g. "RM-1024"
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
  tenantId: TenantId;
}

export interface AuditEvent {
  id: string;
  actor: string; // e.g. "Staff Budi", "Customer", "AI Assistant"
  action: string; // e.g. "CREATE_RESERVATION", "CONFIRM_RESERVATION", "UPDATE_MENU"
  entity: string; // e.g. "Reservation RM-1001", "Menu Rendang"
  timestamp: string;
  details?: string;
  tenantId: TenantId;
}
