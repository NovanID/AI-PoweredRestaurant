import {
  RestaurantProfile,
  Table,
  MenuItem,
  OrderItem,
  Reservation,
  AuditEvent,
  ReservationStatus,
  PaymentStatus,
  TableStatus,
  TableArea,
  MenuCategory,
} from '../types/restaurant';
import {
  DEFAULT_TENANT_ID,
  initialRestaurantProfile,
  initialTables,
  initialMenuItems,
  initialReservations,
  initialAuditEvents,
} from './mock-data';

const STORAGE_KEYS = {
  PROFILE: 'rm_profile_v1',
  TABLES: 'rm_tables_v1',
  MENU: 'rm_menu_v1',
  RESERVATIONS: 'rm_reservations_v1',
  AUDIT: 'rm_audit_v1',
};

type Listener = () => void;

class RestaurantStore {
  private profile: RestaurantProfile = JSON.parse(JSON.stringify(initialRestaurantProfile));
  private tables: Table[] = JSON.parse(JSON.stringify(initialTables));
  private menu: MenuItem[] = JSON.parse(JSON.stringify(initialMenuItems));
  private reservations: Reservation[] = JSON.parse(JSON.stringify(initialReservations));
  private auditEvents: AuditEvent[] = JSON.parse(JSON.stringify(initialAuditEvents));
  private listeners: Set<Listener> = new Set();
  private isInitialized = false;

  constructor() {
    // Note: LocalStorage is initialized on client-mount or on first store mutation
    // to prevent hydration mismatch between server-rendered HTML and client initial render.
  }

  public initFromStorage() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    try {
      const storedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
      const storedTables = localStorage.getItem(STORAGE_KEYS.TABLES);
      const storedMenu = localStorage.getItem(STORAGE_KEYS.MENU);
      const storedReservations = localStorage.getItem(STORAGE_KEYS.RESERVATIONS);
      const storedAudit = localStorage.getItem(STORAGE_KEYS.AUDIT);

      if (storedProfile) this.profile = JSON.parse(storedProfile);
      if (storedTables) this.tables = JSON.parse(storedTables);
      if (storedMenu) this.menu = JSON.parse(storedMenu);
      if (storedReservations) this.reservations = JSON.parse(storedReservations);
      if (storedAudit) this.auditEvents = JSON.parse(storedAudit);

      this.isInitialized = true;
    } catch (e) {
      console.warn('Failed to load restaurant store from localStorage, using in-memory defaults:', e);
    }
  }

  private persist() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(this.profile));
      localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(this.tables));
      localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(this.menu));
      localStorage.setItem(STORAGE_KEYS.RESERVATIONS, JSON.stringify(this.reservations));
      localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(this.auditEvents));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in store listener:', err);
      }
    });
  }

  private recordAudit(actor: string, action: string, entity: string, details?: string) {
    const audit: AuditEvent = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      actor,
      action,
      entity,
      timestamp: new Date().toISOString(),
      details,
      tenantId: DEFAULT_TENANT_ID,
    };
    this.auditEvents.unshift(audit);
  }

  // --- Profile Methods ---
  public getProfile(): RestaurantProfile {
    return { ...this.profile };
  }

  public updateProfile(updated: Partial<RestaurantProfile>, actor: string = 'Staff Admin'): RestaurantProfile {
    this.profile = { ...this.profile, ...updated };
    this.recordAudit(actor, 'UPDATE_PROFILE', 'Restaurant Profile', 'Profil / kebijakan restoran diperbarui');
    this.persist();
    return { ...this.profile };
  }

  // --- Menu Methods ---
  public getMenuItems(category?: MenuCategory | 'Semua', search?: string): MenuItem[] {
    return this.menu.filter((item) => {
      if (category && category !== 'Semua' && item.category !== category) {
        return false;
      }
      if (search && search.trim() !== '') {
        const query = search.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesCategory) return false;
      }
      return true;
    });
  }

  public toggleMenuItemAvailability(id: string, actor: string = 'Staff Restoran'): { success: boolean; item?: MenuItem } {
    const item = this.menu.find((m) => m.id === id);
    if (!item) return { success: false };
    item.isAvailable = !item.isAvailable;
    this.recordAudit(
      actor,
      'TOGGLE_MENU_AVAILABILITY',
      `Menu ${item.name}`,
      `Status stok diubah menjadi ${item.isAvailable ? 'Tersedia' : 'Habis'}`
    );
    this.persist();
    return { success: true, item: { ...item } };
  }

  // --- Tables & Availability Methods ---
  public getTables(): Table[] {
    return [...this.tables];
  }

  /**
   * Helper: check if two time slots overlap (assuming standard 90 mins slot)
   */
  private isTimeOverlap(timeA: string, timeB: string, durationMinutes = 90): boolean {
    const [hA, mA] = timeA.split(':').map(Number);
    const [hB, mB] = timeB.split(':').map(Number);
    const minA = hA * 60 + mA;
    const minB = hB * 60 + mB;
    return Math.abs(minA - minB) < durationMinutes;
  }

  /**
   * Check availability based on date, time, and guestCount
   */
  public checkAvailability(
    date: string,
    time: string,
    guestCount: number,
    preferredArea?: TableArea
  ): {
    available: boolean;
    availableTables: Table[];
    reason?: string;
  } {
    // 1. Validate operating hours
    const [h, m] = (time || '00:00').split(':').map(Number);
    const requestedMinutes = h * 60 + (m || 0);
    const [openH, openM] = this.profile.openTime.split(':').map(Number);
    const [closeH, closeM] = this.profile.closeTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (requestedMinutes < openMinutes || requestedMinutes + 60 > closeMinutes) {
      return {
        available: false,
        availableTables: [],
        reason: `Restoran hanya melayani reservasi antara ${this.profile.openTime} – ${this.profile.closeTime} WIB.`,
      };
    }

    // 2. Filter tables by capacity & status
    const suitableTables = this.tables.filter((tbl) => {
      if (tbl.status === 'maintenance') return false;
      if (tbl.capacity < guestCount) return false;
      if (preferredArea && tbl.area !== preferredArea) return false;
      return true;
    });

    if (suitableTables.length === 0) {
      return {
        available: false,
        availableTables: [],
        reason: preferredArea
          ? `Tidak ditemukan meja di area ${preferredArea} yang mencukupi untuk ${guestCount} tamu.`
          : `Tidak ada meja yang cukup untuk kapasitas ${guestCount} orang.`,
      };
    }

    // 3. Filter out tables that already have active reservation at the same time
    const now = Date.now();
    const activeReservationsOnDate = this.reservations.filter((r) => {
      if (r.date !== date) return false;
      // Active if confirmed or seated
      if (r.status === 'confirmed' || r.status === 'seated') return true;
      // Active if pending with unexpired TTL
      if (r.status === 'pending') {
        if (!r.expiresAt) return true;
        return new Date(r.expiresAt).getTime() > now;
      }
      return false;
    });

    const freeTables = suitableTables.filter((tbl) => {
      const hasConflict = activeReservationsOnDate.some(
        (res) => res.tableId === tbl.id && this.isTimeOverlap(res.time, time)
      );
      return !hasConflict;
    });

    if (freeTables.length === 0) {
      return {
        available: false,
        availableTables: [],
        reason: `Semua meja untuk kapasitas ${guestCount} tamu pada pukul ${time} tanggal ${date} sudah terisi. Silakan pilih jam lain.`,
      };
    }

    return {
      available: true,
      availableTables: freeTables,
    };
  }

  // --- Reservation Methods ---
  public createReservation(data: {
    customerName: string;
    customerPhone?: string;
    date: string;
    time: string;
    guestCount: number;
    notes?: string;
    preferredArea?: TableArea;
    paymentAmount?: number;
    paymentStatus?: PaymentStatus;
    snapToken?: string;
    actor?: string;
  }): {
    success: boolean;
    reservation?: Reservation;
    message: string;
  } {
    const {
      customerName,
      customerPhone = '-',
      date,
      time,
      guestCount,
      notes,
      preferredArea,
      paymentAmount = 0,
      paymentStatus = 'unpaid',
      snapToken,
      actor = 'Sistem Reservasi Otomatis',
    } = data;

    if (!customerName || !date || !time || !guestCount) {
      return { success: false, message: 'Mohon lengkapi semua data reservasi yang wajib diisi.' };
    }

    // Atomic availability check
    const check = this.checkAvailability(date, time, guestCount, preferredArea);
    if (!check.available || check.availableTables.length === 0) {
      return {
        success: false,
        message: check.reason || 'Ketersediaan meja tidak mencukupi untuk waktu yang dipilih.',
      };
    }

    // Pick best matching table (smallest capacity that fits)
    const selectedTable = [...check.availableTables].sort((a, b) => a.capacity - b.capacity)[0];

    // Generate secure random alphanumeric code e.g. RM-7K9A
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `RM-${randomChars}`;
    const qrToken = `QR-${code}-VERIFIED`;

    // Instant confirmation by system (Zero manual admin bottleneck)
    const newReservation: Reservation = {
      id: `res-${Date.now()}`,
      code,
      customerName,
      customerPhone: customerPhone?.trim() || '-',
      tableId: selectedTable.id,
      tableNumber: selectedTable.number,
      tableArea: selectedTable.area,
      date,
      time,
      guestCount,
      status: 'confirmed',
      autoConfirmed: true,
      qrToken,
      paymentStatus,
      paymentAmount,
      snapToken,
      notes: notes || '',
      tenantId: DEFAULT_TENANT_ID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.reservations.unshift(newReservation);
    this.recordAudit(
      actor,
      'AUTO_CONFIRM_RESERVATION',
      `Reservasi ${code}`,
      `Slot Meja ${selectedTable.number} (${selectedTable.area}, ${guestCount} tamu) berhasil dikunci & dikonfirmasi otomatis untuk ${customerName} (${date} ${time} WIB)${
        paymentAmount > 0 ? ` [Deposit: Rp ${paymentAmount.toLocaleString('id-ID')}]` : ''
      }`
    );
    this.persist();

    return {
      success: true,
      reservation: { ...newReservation },
      message: `Reservasi berhasil dikonfirmasi otomatis oleh sistem dengan kode ${code}. Meja Anda telah terkunci!`,
    };
  }

  public getReservationByCode(code: string): Reservation | undefined {
    if (!code) return undefined;
    const clean = code.trim().toUpperCase();
    const found = this.reservations.find((r) => r.code.toUpperCase() === clean);
    return found ? { ...found } : undefined;
  }

  public getAllReservations(filterStatus?: ReservationStatus | 'all'): Reservation[] {
    if (!filterStatus || filterStatus === 'all') {
      return [...this.reservations];
    }
    return this.reservations.filter((r) => r.status === filterStatus);
  }

  public updateReservation(
    code: string,
    newData: {
      date?: string;
      time?: string;
      guestCount?: number;
      notes?: string;
      preferredArea?: TableArea;
    },
    actor: string = 'Sistem Reservasi Otomatis'
  ): { success: boolean; message: string; reservation?: Reservation } {
    const clean = code.trim().toUpperCase();
    const target = this.reservations.find((r) => r.code.toUpperCase() === clean);

    if (!target) {
      return { success: false, message: `Reservasi dengan kode "${code}" tidak ditemukan.` };
    }

    if (target.status === 'cancelled' || target.status === 'completed') {
      return { success: false, message: `Reservasi ${code} dengan status "${target.status}" tidak dapat diubah lagi.` };
    }

    const targetDate = newData.date || target.date;
    const targetTime = newData.time || target.time;
    const targetGuests = newData.guestCount !== undefined ? Number(newData.guestCount) : target.guestCount;
    const targetArea = newData.preferredArea || target.tableArea;

    // Check operating hours
    const [h, m] = (targetTime || '00:00').split(':').map(Number);
    const requestedMinutes = h * 60 + (m || 0);
    const [openH, openM] = this.profile.openTime.split(':').map(Number);
    const [closeH, closeM] = this.profile.closeTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (requestedMinutes < openMinutes || requestedMinutes + 60 > closeMinutes) {
      return {
        success: false,
        message: `Restoran hanya melayani reservasi antara ${this.profile.openTime} – ${this.profile.closeTime} WIB.`,
      };
    }

    const suitableTables = this.tables.filter((tbl) => {
      if (tbl.status === 'maintenance') return false;
      if (tbl.capacity < targetGuests) return false;
      if (targetArea && tbl.area !== targetArea) return false;
      return true;
    });

    if (suitableTables.length === 0) {
      return {
        success: false,
        message: `Tidak ada meja yang cukup untuk ${targetGuests} orang di area ${targetArea}.`,
      };
    }

    const now = Date.now();
    const activeReservationsOnDate = this.reservations.filter(
      (r) =>
        r.code !== target.code &&
        r.date === targetDate &&
        (r.status === 'confirmed' ||
          r.status === 'seated' ||
          (r.status === 'pending' && (!r.expiresAt || new Date(r.expiresAt).getTime() > now)))
    );

    const freeTables = suitableTables.filter((tbl) => {
      const hasConflict = activeReservationsOnDate.some(
        (res) => res.tableId === tbl.id && this.isTimeOverlap(res.time, targetTime)
      );
      return !hasConflict;
    });

    if (freeTables.length === 0) {
      return {
        success: false,
        message: `Jadwal baru (${targetDate} jam ${targetTime}) sudah penuh. Silakan pilih jam lain.`,
      };
    }

    const selectedTable = [...freeTables].sort((a, b) => a.capacity - b.capacity)[0];

    target.date = targetDate;
    target.time = targetTime;
    target.guestCount = targetGuests;
    target.tableId = selectedTable.id;
    target.tableNumber = selectedTable.number;
    target.tableArea = selectedTable.area;
    if (newData.notes !== undefined) target.notes = newData.notes;
    target.status = 'confirmed'; // Instant auto-confirmed on reschedule
    target.autoConfirmed = true;
    target.updatedAt = new Date().toISOString();

    this.recordAudit(
      actor,
      'AUTO_RESCHEDULE_RESERVATION',
      `Reservasi ${target.code}`,
      `Perubahan jadwal ke ${targetDate} ${targetTime} WIB (${targetGuests} tamu, Meja ${selectedTable.number}) otomatis dikonfirmasi sistem.`
    );
    this.persist();

    return {
      success: true,
      message: `Jadwal reservasi ${target.code} berhasil diperbarui dan langsung terkonfirmasi otomatis oleh sistem.`,
      reservation: { ...target },
    };
  }

  // --- Operational Floor & Guest Lifecycle Methods ---
  public createWalkInSeated(
    tableId: string,
    guestCount?: number,
    actor: string = 'Staff Kasir (Budi)'
  ): { success: boolean; message: string; reservation?: Reservation } {
    const table = this.tables.find((t) => t.id === tableId);
    if (!table) {
      return { success: false, message: 'Meja tidak ditemukan.' };
    }
    if (table.status === 'maintenance') {
      return { success: false, message: `Meja ${table.number} sedang dalam masa perbaikan/maintenance.` };
    }

    // Set table status to occupied
    table.status = 'occupied';

    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `WI-${randomChars}`;
    const qrToken = `QR-${code}-WALKIN`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

    const newReservation: Reservation = {
      id: `res-walkin-${Date.now()}`,
      code,
      customerName: `Tamu Walk-In (${table.number})`,
      customerPhone: '-',
      tableId: table.id,
      tableNumber: table.number,
      tableArea: table.area,
      date: dateStr,
      time: timeStr,
      guestCount: guestCount || table.capacity,
      status: 'seated',
      autoConfirmed: true,
      qrToken,
      seatedAt: now.toISOString(),
      paymentStatus: 'unpaid',
      notes: 'Tamu langsung datang tanpa reservasi (Walk-In)',
      tenantId: this.profile.tenantId || DEFAULT_TENANT_ID,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.reservations.unshift(newReservation);
    this.recordAudit(
      actor,
      'WALK_IN_SEATED',
      `Meja ${table.number}`,
      `Tamu Walk-In (${newReservation.guestCount} orang) dipersilakan duduk di Meja ${table.number} (Kode: ${code}).`
    );
    this.persist();

    return {
      success: true,
      message: `Tamu Walk-In berhasil didudukkan di Meja ${table.number}. Status meja menjadi Terisi (Seated).`,
      reservation: { ...newReservation },
    };
  }

  public createManualOfflineBooking(data: {
    customerName: string;
    customerPhone?: string;
    tableId: string;
    guestCount: number;
    notes?: string;
    actionType: 'seated_now' | 'scheduled';
    date?: string;
    time?: string;
    actor?: string;
  }): { success: boolean; message: string; reservation?: Reservation } {
    const table = this.tables.find((t) => t.id === data.tableId);
    if (!table) return { success: false, message: 'Meja tidak ditemukan.' };
    if (table.status === 'maintenance') {
      return { success: false, message: `Meja ${table.number} sedang maintenance/rusak.` };
    }

    const now = new Date();
    const isSeatedNow = data.actionType === 'seated_now';
    const dateStr = data.date || now.toISOString().split('T')[0];
    const timeStr = data.time || now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = isSeatedNow ? `WI-${randomChars}` : `RM-M${randomChars}`;

    if (isSeatedNow) {
      table.status = 'occupied';
    }

    const newReservation: Reservation = {
      id: `res-manual-${Date.now()}`,
      code,
      customerName: data.customerName.trim() || `Tamu Offline (${table.number})`,
      customerPhone: data.customerPhone?.trim() || '-',
      tableId: table.id,
      tableNumber: table.number,
      tableArea: table.area,
      date: dateStr,
      time: timeStr,
      guestCount: data.guestCount || table.capacity,
      status: isSeatedNow ? 'seated' : 'confirmed',
      autoConfirmed: true,
      qrToken: `QR-${code}-OFFLINE`,
      seatedAt: isSeatedNow ? now.toISOString() : undefined,
      paymentStatus: 'unpaid',
      notes: data.notes || (isSeatedNow ? 'Tamu Walk-In Kasir Offline' : 'Reservasi Manual Kasir'),
      tenantId: this.profile.tenantId || DEFAULT_TENANT_ID,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.reservations.unshift(newReservation);
    this.recordAudit(
      data.actor || 'Staf Kasir Offline',
      isSeatedNow ? 'MANUAL_WALKIN_SEATED' : 'MANUAL_RESERVATION_CREATED',
      `Meja ${table.number}`,
      `Input tamu manual (${newReservation.customerName}, ${newReservation.guestCount} orang, ${newReservation.status}) di Meja ${table.number}.`
    );
    this.persist();

    return {
      success: true,
      message: `Tamu ${newReservation.customerName} berhasil dicatat di Meja ${table.number} (Kode: ${code}).`,
      reservation: { ...newReservation },
    };
  }

  public addOrderItemsToReservation(
    code: string,
    items: OrderItem[],
    actor: string = 'Staf Kasir'
  ): { success: boolean; message: string; reservation?: Reservation } {
    const clean = code.trim().toUpperCase();
    const target = this.reservations.find((r) => r.code.toUpperCase() === clean);
    if (!target) return { success: false, message: `Tiket tamu ${code} tidak ditemukan.` };

    target.orderItems = items;
    const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    target.orderTotal = total;
    target.paymentAmount = total;
    target.updatedAt = new Date().toISOString();

    this.recordAudit(
      actor,
      'UPDATE_TABLE_ORDER',
      `Reservasi ${target.code}`,
      `Pesanan ${items.length} menu ditambahkan ke Meja ${target.tableNumber}. Total Tagihan: Rp ${total.toLocaleString('id-ID')}`
    );
    this.persist();

    return {
      success: true,
      message: `Pesanan Meja ${target.tableNumber} berhasil disimpan (Total: Rp ${total.toLocaleString('id-ID')}).`,
      reservation: { ...target },
    };
  }

  public settleOfflinePayment(
    code: string,
    paymentMethod: string = 'Tunai / Cash',
    actor: string = 'Staf Kasir'
  ): { success: boolean; message: string; reservation?: Reservation } {
    const clean = code.trim().toUpperCase();
    const target = this.reservations.find((r) => r.code.toUpperCase() === clean);
    if (!target) return { success: false, message: `Tiket tamu ${code} tidak ditemukan.` };

    target.paymentStatus = 'settlement';
    target.paymentMethod = paymentMethod;
    target.paymentPaidAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();

    this.recordAudit(
      actor,
      'OFFLINE_PAYMENT_SETTLED',
      `Reservasi ${target.code}`,
      `Pembayaran pesanan Rp ${(target.orderTotal || target.paymentAmount || 0).toLocaleString('id-ID')} lunas via ${paymentMethod}.`
    );
    this.persist();

    return {
      success: true,
      message: `Pembayaran tiket ${target.code} (Meja ${target.tableNumber}) BERHASIL LUNAS via ${paymentMethod}.`,
      reservation: { ...target },
    };
  }

  public markAsSeated(
    code: string,
    actor: string = 'Staf Penerima Tamu'
  ): { success: boolean; message: string; reservation?: Reservation } {
    const clean = code.trim().toUpperCase();
    const target = this.reservations.find((r) => r.code.toUpperCase() === clean);

    if (!target) {
      return { success: false, message: `Reservasi ${code} tidak ditemukan.` };
    }

    target.status = 'seated';
    target.seatedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();

    // Mark corresponding table occupied
    const table = this.tables.find((t) => t.id === target.tableId);
    if (table) {
      table.status = 'occupied';
    }

    this.recordAudit(
      actor,
      'GUEST_CHECKIN_SEATED',
      `Reservasi ${target.code}`,
      `Tamu ${target.customerName} (${target.guestCount} orang) telah tiba & dipersilakan duduk di Meja ${target.tableNumber}.`
    );
    this.persist();

    return {
      success: true,
      message: `Tamu ${target.customerName} berhasil di-check-in ke Meja ${target.tableNumber} (Status: Seated).`,
      reservation: { ...target },
    };
  }

  public markAsCompleted(
    code: string,
    actor: string = 'Staf Kasir / Waiter'
  ): { success: boolean; message: string; reservation?: Reservation } {
    const clean = code.trim().toUpperCase();
    const target = this.reservations.find((r) => r.code.toUpperCase() === clean);

    if (!target) {
      return { success: false, message: `Reservasi ${code} tidak ditemukan.` };
    }

    target.status = 'completed';
    target.completedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();

    // Release table back to available if no other seated guest is on the table
    const table = this.tables.find((t) => t.id === target.tableId);
    if (table && table.status === 'occupied') {
      const otherSeated = this.reservations.some(
        (r) => r.code !== target.code && r.tableId === table.id && r.status === 'seated'
      );
      if (!otherSeated) {
        table.status = 'available';
      }
    }

    this.recordAudit(
      actor,
      'GUEST_COMPLETED',
      `Reservasi ${target.code}`,
      `Tamu ${target.customerName} telah selesai bersantap. Meja ${target.tableNumber} kembali bersih dan siap digunakan.`
    );
    this.persist();

    return {
      success: true,
      message: `Reservasi ${target.code} selesai. Meja ${target.tableNumber} kembali Kosong / Siap Tamu Baru.`,
      reservation: { ...target },
    };
  }

  public markAsNoShow(
    code: string,
    actor: string = 'Staf Restoran',
    reason: string = 'Tamu tidak hadir melewati batas toleransi 30 menit'
  ): { success: boolean; message: string; reservation?: Reservation } {
    const clean = code.trim().toUpperCase();
    const target = this.reservations.find((r) => r.code.toUpperCase() === clean);

    if (!target) {
      return { success: false, message: `Reservasi ${code} tidak ditemukan.` };
    }

    target.status = 'no_show';
    target.rejectionReason = reason;
    target.updatedAt = new Date().toISOString();

    // Release table if occupied
    const table = this.tables.find((t) => t.id === target.tableId);
    if (table && table.status === 'occupied') {
      table.status = 'available';
    }

    this.recordAudit(
      actor,
      'GUEST_NO_SHOW',
      `Reservasi ${target.code}`,
      `Tamu ${target.customerName} tidak hadir (${reason}). Meja ${target.tableNumber} kembali dilepas.`
    );
    this.persist();

    return {
      success: true,
      message: `Reservasi ${target.code} ditandai No-Show. Slot meja telah dilepas kembali.`,
      reservation: { ...target },
    };
  }

  public autoReleaseExpiredLocks(): number {
    const now = Date.now();
    let releasedCount = 0;

    this.reservations.forEach((r) => {
      if (r.status === 'pending' && r.expiresAt && new Date(r.expiresAt).getTime() <= now) {
        r.status = 'expired';
        r.updatedAt = new Date().toISOString();
        releasedCount++;
        this.recordAudit(
          'Sistem Reservasi Otomatis (TTL)',
          'AUTO_EXPIRE_LOCK',
          `Reservasi ${r.code}`,
          `Batas waktu pembayaran deposit telah habis. Slot Meja ${r.tableNumber} dilepas otomatis.`
        );
      }
    });

    if (releasedCount > 0) {
      this.persist();
    }
    return releasedCount;
  }

  public updateTableStatus(
    id: string,
    status: TableStatus,
    actor: string = 'Staff Restoran'
  ): { success: boolean; table?: Table } {
    const tbl = this.tables.find((t) => t.id === id);
    if (!tbl) return { success: false };

    tbl.status = status;
    const statusLabel = {
      available: 'Kosong (Tersedia)',
      occupied: 'Terisi (Tamu Walk-in / Makan)',
      reserved: 'Dipesan',
      maintenance: 'Perawatan / Rusak',
    }[status];

    this.recordAudit(
      actor,
      'UPDATE_TABLE_STATUS',
      `Meja ${tbl.number}`,
      `Status meja diubah menjadi ${statusLabel}`
    );
    this.persist();
    return { success: true, table: { ...tbl } };
  }

  public updateReservationStatus(
    code: string,
    status: ReservationStatus,
    actor: string = 'Staff Restoran',
    reason?: string
  ): { success: boolean; message: string; reservation?: Reservation } {
    const clean = code.trim().toUpperCase();
    const target = this.reservations.find((r) => r.code.toUpperCase() === clean);

    if (!target) {
      return { success: false, message: `Reservasi dengan kode "${code}" tidak ditemukan.` };
    }

    target.status = status;
    target.updatedAt = new Date().toISOString();
    if (reason) target.rejectionReason = reason;

    // Synchronize Table Status with Reservation Lifecycle
    const table = this.tables.find((t) => t.id === target.tableId);
    if (table) {
      if (status === 'seated') {
        table.status = 'occupied';
        target.seatedAt = new Date().toISOString();
      } else if (['completed', 'cancelled', 'rejected', 'no_show', 'expired'].includes(status)) {
        if (status === 'completed') target.completedAt = new Date().toISOString();
        // Return table to available if no other seated guest is on it
        const otherSeated = this.reservations.some(
          (r) => r.code !== target.code && r.tableId === table.id && r.status === 'seated'
        );
        if (!otherSeated && table.status !== 'maintenance') {
          table.status = 'available';
        }
      }
    }

    const statusLabels: Record<ReservationStatus, string> = {
      pending: 'Menunggu Pembayaran',
      confirmed: 'Terkonfirmasi Otomatis',
      seated: 'Tamu Tiba (Seated)',
      completed: 'Selesai Bersantap',
      cancelled: 'Dibatalkan',
      rejected: 'Ditolak',
      no_show: 'Tidak Hadir (No-Show)',
      expired: 'Kadaluarsa (Expired)',
    };

    this.recordAudit(
      actor,
      `STATUS_${status.toUpperCase()}`,
      `Reservasi ${target.code}`,
      `Status reservasi diubah menjadi ${statusLabels[status]}${reason ? `. Alasan: ${reason}` : ''}`
    );
    this.persist();

    return {
      success: true,
      message: `Status reservasi ${target.code} berhasil diperbarui menjadi ${statusLabels[status]}.`,
      reservation: { ...target },
    };
  }

  // --- Payment Methods ---
  public setReservationSnapToken(code: string, snapToken: string): boolean {
    const clean = code.trim().toUpperCase();
    const target = this.reservations.find((r) => r.code.toUpperCase() === clean);
    if (!target) return false;
    target.snapToken = snapToken;
    target.updatedAt = new Date().toISOString();
    this.persist();
    return true;
  }

  public updatePaymentStatus(
    code: string,
    paymentStatus: PaymentStatus,
    paymentMethod?: string,
    amount?: number,
    actor: string = 'Midtrans Webhook'
  ): { success: boolean; message: string; reservation?: Reservation } {
    const clean = code.trim().toUpperCase();
    const target = this.reservations.find((r) => r.code.toUpperCase() === clean);

    if (!target) {
      return { success: false, message: `Reservasi dengan kode "${code}" tidak ditemukan.` };
    }

    target.paymentStatus = paymentStatus;
    if (paymentMethod) target.paymentMethod = paymentMethod;
    if (amount !== undefined) target.paymentAmount = amount;
    target.updatedAt = new Date().toISOString();

    if (paymentStatus === 'settlement') {
      target.paymentPaidAt = new Date().toISOString();
      // Auto-confirm reservation when deposit/payment is settled
      target.status = 'confirmed';
      this.recordAudit(
        actor,
        'PAYMENT_SETTLEMENT',
        `Reservasi ${target.code}`,
        `Pembayaran berhasil (Lunas) via ${paymentMethod || 'Midtrans Snap'}. Status otomatis DIKONFIRMASI.`
      );
    } else if (paymentStatus === 'expire' || paymentStatus === 'cancel') {
      this.recordAudit(
        actor,
        'PAYMENT_FAILED',
        `Reservasi ${target.code}`,
        `Pembayaran ${paymentStatus === 'expire' ? 'kadaluarsa (Expired)' : 'dibatalkan (Cancelled)'}.`
      );
    } else {
      this.recordAudit(
        actor,
        'PAYMENT_PENDING',
        `Reservasi ${target.code}`,
        `Menunggu pembayaran customer via ${paymentMethod || 'Midtrans Snap'}.`
      );
    }

    this.persist();

    return {
      success: true,
      message: `Status pembayaran reservasi ${target.code} diubah menjadi ${paymentStatus}.`,
      reservation: { ...target },
    };
  }

  // --- Audit Methods ---
  public getAuditEvents(): AuditEvent[] {
    return [...this.auditEvents];
  }

  // Reset to initial mock data (for testing/demo purposes)
  public resetToDefaults() {
    this.profile = JSON.parse(JSON.stringify(initialRestaurantProfile));
    this.tables = JSON.parse(JSON.stringify(initialTables));
    this.menu = JSON.parse(JSON.stringify(initialMenuItems));
    this.reservations = JSON.parse(JSON.stringify(initialReservations));
    this.auditEvents = JSON.parse(JSON.stringify(initialAuditEvents));
    this.persist();
  }
}

// Global Singleton Instance
export const restaurantStore = new RestaurantStore();
