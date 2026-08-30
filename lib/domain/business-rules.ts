import { RestaurantProfile, TableArea } from './types';

export interface RuleValidationResult {
  passed: boolean;
  errorCode?: string;
  message?: string;
}

export class BusinessRuleEngine {
  /**
   * Rule 1: Validate Operating Hours
   * Restoran hanya melayani pemesanan/reservasi pada jam operasional
   */
  public static validateOperatingHours(
    profile: RestaurantProfile,
    targetTime: string
  ): RuleValidationResult {
    if (!targetTime || !targetTime.includes(':')) {
      return { passed: false, errorCode: 'INVALID_TIME_FORMAT', message: 'Format jam tidak valid.' };
    }

    const [h, m] = targetTime.split(':').map(Number);
    const targetMinutes = h * 60 + (m || 0);

    const [openH, openM] = profile.openTime.split(':').map(Number);
    const [closeH, closeM] = profile.closeTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (targetMinutes < openMinutes || targetMinutes + 60 > closeMinutes) {
      return {
        passed: false,
        errorCode: 'RESTAURANT_CLOSED',
        message: `Restoran ${profile.name} hanya melayani reservasi antara pukul ${profile.openTime} – ${profile.closeTime} WIB.`,
      };
    }

    return { passed: true };
  }

  /**
   * Rule 2: Capacity & Area Constraints
   * Pembatasan jumlah tamu per area (contoh: VIP minimal 6 orang, outdoor maks 8 orang)
   */
  public static validateCapacity(
    guestCount: number,
    area?: TableArea
  ): RuleValidationResult {
    if (guestCount <= 0) {
      return { passed: false, errorCode: 'INVALID_GUEST_COUNT', message: 'Jumlah tamu minimal 1 orang.' };
    }

    if (guestCount > 30) {
      return {
        passed: false,
        errorCode: 'EXCEEDS_MAX_CAPACITY',
        message: 'Untuk reservasi rombongan di atas 30 orang, mohon hubungi tim event khusus restoran kami.',
      };
    }

    if (area === 'VIP' && guestCount < 4) {
      return {
        passed: false,
        errorCode: 'VIP_MINIMUM_GUESTS',
        message: 'Ruangan VIP dikhususkan untuk minimal 4 tamu. Untuk 1-3 tamu disarankan area Indoor atau Outdoor yang nyaman.',
      };
    }

    return { passed: true };
  }

  /**
   * Rule 3: Cart / Order Bounds
   */
  public static validateOrderBounds(items: Array<{ quantity: number; price: number }>): RuleValidationResult {
    if (!items || items.length === 0) {
      return { passed: false, errorCode: 'EMPTY_CART', message: 'Keranjang pesanan tidak boleh kosong.' };
    }

    for (const item of items) {
      if (item.quantity <= 0 || item.quantity > 50) {
        return {
          passed: false,
          errorCode: 'INVALID_ITEM_QUANTITY',
          message: 'Kuantitas pesanan per menu harus antara 1 sampai 50 porsi.',
        };
      }
    }

    return { passed: true };
  }
}
