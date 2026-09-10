import { MenuItem, Reservation, RestaurantProfile } from '../domain/types';
import { ToolResult, ConversationSession } from './types';

export interface ActionButton {
  label: string;
  action: string;
  payload?: any;
}

export interface GenerateButtonsParams {
  userMessage: string;
  replyText: string;
  toolExecuted?: ToolResult;
  menuSnapshot: MenuItem[];
  session?: ConversationSession;
  profile?: RestaurantProfile;
  currentTime?: string; // Format "HH:mm"
}

export class ActionButtonEngine {
  /**
   * Check if current time is within restaurant operational hours
   */
  public static isRestaurantOpen(profile?: RestaurantProfile, checkTime?: string): boolean {
    if (!profile?.openTime || !profile?.closeTime) return true;
    let timeStr = checkTime;
    if (!timeStr) {
      const now = new Date();
      timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    const [openH, openM] = profile.openTime.split(':').map(Number);
    const [closeH, closeM] = profile.closeTime.split(':').map(Number);
    const [curH, curM] = timeStr.split(':').map(Number);

    const openMin = openH * 60 + (openM || 0);
    const closeMin = closeH * 60 + (closeM || 0);
    const curMin = curH * 60 + (curM || 0);

    return curMin >= openMin && curMin <= closeMin;
  }

  /**
   * Check if user sentence contains negative/exclusion intent targeting specific dish keywords
   * (Bounded by clause separators like commas, periods, or contrast conjunctions)
   */
  private static isNegatedOrExcluded(text: string, dishKeywords: string[]): boolean {
    const lower = text.toLowerCase();
    const negations = [
      'jangan', 'tidak mau', 'gak mau', 'nggak mau', 'bukan',
      'alergi', 'tanpa', 'gak suka', 'tidak suka', 'hindari', 'selain',
    ];

    for (const neg of negations) {
      let startIndex = 0;
      while ((startIndex = lower.indexOf(neg, startIndex)) !== -1) {
        const afterNeg = lower.slice(startIndex + neg.length);
        // Negation scope ends at punctuation (, . ! ? ;) or clause transition words (ada, tapi, tetapi, malah, melainkan, kalau)
        const boundaryMatch = afterNeg.match(/[,.!?;\n]|(\b(ada|tapi|tetapi|malah|melainkan|kalau|mau)\b)/);
        const boundaryIndex = boundaryMatch?.index !== undefined ? boundaryMatch.index : Math.min(afterNeg.length, 30);
        const scopedText = afterNeg.slice(0, boundaryIndex);

        if (dishKeywords.some((kw) => scopedText.includes(kw))) {
          return true;
        }
        startIndex += neg.length;
      }
    }
    return false;
  }

  /**
   * Generates dynamic, context-aware action buttons based on:
   * - Session state (e.g. WAITING_CONFIRMATION)
   * - Executed tool results
   * - Operating hours (Open vs Closed)
   * - In-stock available menu items
   * - Negative / allergy exclusion detection
   * - Multi-dish detection & dynamic tenant categories
   */
  public static generateButtons(params: GenerateButtonsParams): ActionButton[] {
    const { userMessage, replyText, toolExecuted, menuSnapshot = [], session, profile, currentTime } = params;
    const lowerUser = userMessage.toLowerCase();
    const lowerReply = replyText.toLowerCase();
    const isOpen = this.isRestaurantOpen(profile, currentTime);

    // Filter only currently available (in-stock) items
    const availableMenu = menuSnapshot.filter((m) => m.isAvailable !== false);

    // 1. Session State Machine Override
    if (session?.state === 'WAITING_CONFIRMATION' && session.pendingAction?.type === 'CONFIRM_RESERVATION') {
      return [
        { label: '✅ Ya, Konfirmasi Booking', action: 'confirm_pending_booking' },
        { label: '❌ Batal', action: 'cancel_booking_prompt' },
      ];
    }

    // 2. Tool-Specific Contextual Next Steps
    if (toolExecuted) {
      if (toolExecuted.tool === 'request_reservation_hold' && toolExecuted.success) {
        return [
          { label: '✅ Ya, Konfirmasi Booking', action: 'confirm_pending_booking' },
          { label: '❌ Batal', action: 'cancel_booking_prompt' },
        ];
      }

      if (toolExecuted.tool === 'confirm_reservation') {
        if (toolExecuted.success) {
          const res = toolExecuted.data as Reservation;
          return [
            { label: `🎫 Lacak Tiket ${res?.code || ''}`, action: `check_code_${res?.code || ''}` },
            { label: '🥘 Pilih Menu Makanan', action: 'show_menu' },
          ];
        } else {
          return [
            { label: '🔄 Coba Cek Meja Lain', action: 'check_tables' },
            { label: '🥘 Lihat Menu', action: 'show_menu' },
          ];
        }
      }

      if (toolExecuted.tool === 'check_availability') {
        if (toolExecuted.success) {
          return [
            { label: '📝 Lanjut Booking Meja Ini', action: 'proceed_booking' },
            { label: '🥘 Rekomendasi Menu Favorit', action: 'show_menu' },
          ];
        } else {
          return [
            { label: '🕒 Cek Jam Lain Hari Ini', action: 'check_other_time' },
            { label: '📦 Pesan Bungkus (Take Away)', action: 'takeaway_fallback' },
          ];
        }
      }

      if (toolExecuted.tool === 'calculate_order_total') {
        if (toolExecuted.success) {
          const totalAmt = toolExecuted.data?.total || 0;
          return [
            {
              label: totalAmt > 0 ? `💳 Lanjut ke Pembayaran (Rp ${totalAmt.toLocaleString('id-ID')})` : '💳 Lanjut ke Pembayaran',
              action: 'proceed_payment',
              payload: { message: 'Saya mau lanjut ke pembayaran pesanan ini' },
            },
            { label: '📍 Lokasi & Jam Ambil', action: 'show_hours' },
            { label: '🥤 Tambah Minuman Segar', action: 'ask_drinks' },
          ];
        } else {
          return [
            { label: '🥘 Lihat Menu Favorit', action: 'show_menu' },
            { label: '🪑 Cek Meja Kosong', action: 'check_tables' },
          ];
        }
      }

      if (toolExecuted.tool === 'create_takeaway_order') {
        if (toolExecuted.success) {
          const order = toolExecuted.data;
          const code = order?.orderCode || order?.reservation?.code || '';
          const total = order?.total || order?.reservation?.orderTotal || 0;
          return [
            {
              label: `💳 Bayar Sekarang via Midtrans`,
              action: `pay_snap_${code}`,
              payload: { orderCode: code, amount: total },
            },
            {
              label: '💵 Bayar Tunai saat Ambil di Kasir',
              action: 'pay_cash',
              payload: { message: `Saya akan bayar tunai di kasir saat ambil pesanan ${code}` },
            },
            { label: '📍 Petunjuk Lokasi Restoran', action: 'show_hours' },
          ];
        } else {
          return [
            { label: '🔄 Coba Pesan Ulang', action: 'takeaway_fallback' },
            { label: '🥘 Lihat Menu', action: 'show_menu' },
          ];
        }
      }

      if (toolExecuted.tool === 'get_reservation' && toolExecuted.success && toolExecuted.data) {
        const r = toolExecuted.data as Reservation;
        return [
          { label: `🎫 Buka Panel Tiket`, action: `check_code_${r.code}` },
          { label: `❌ Batalkan Reservasi`, action: `cancel_${r.code}` },
        ];
      }
    }

    // 3. Multi-Dish Scoring & Exclusion Detection
    const scoredMatches: Array<{ item: MenuItem; score: number }> = [];

    for (const m of availableMenu) {
      const name = m.name.toLowerCase();
      const words = name.split(/\s+/).filter((w) => w.length > 2 && !['khas', 'spesial', 'padang'].includes(w));

      // Skip if explicitly negated by customer (e.g. "jangan ayam bakar")
      if (this.isNegatedOrExcluded(lowerUser, [name, ...words])) {
        continue;
      }

      let score = 0;
      if (lowerUser.includes(name)) {
        score = 100;
      } else if (lowerReply.includes(name)) {
        score = 80;
      } else {
        const userMatchedWords = words.filter((w) => lowerUser.includes(w));
        const replyMatchedWords = words.filter((w) => lowerReply.includes(w));
        const totalMatched = new Set([...userMatchedWords, ...replyMatchedWords]).size;

        if (totalMatched > 0) {
          score = (userMatchedWords.length * 40) + (totalMatched / words.length) * 30;
        }
      }

      if (score >= 35) {
        scoredMatches.push({ item: m, score });
      }
    }

    scoredMatches.sort((a, b) => b.score - a.score);

    // Multi-item match: User inquired about 2 distinct dishes
    if (scoredMatches.length >= 2) {
      const item1 = scoredMatches[0].item;
      const item2 = scoredMatches[1].item;
      return [
        {
          label: `📦 Bungkus 1 Porsi ${item1.name}`,
          action: 'order_takeaway',
          payload: { menuName: item1.name, message: `Saya mau pesan bungkus 1 porsi ${item1.name}` },
        },
        {
          label: `📦 Bungkus 1 Porsi ${item2.name}`,
          action: 'order_takeaway',
          payload: { menuName: item2.name, message: `Saya mau pesan bungkus 1 porsi ${item2.name}` },
        },
        isOpen
          ? {
              label: '🍽️ Makan di Tempat',
              action: 'order_dinein',
              payload: { message: `Saya mau makan di tempat pesan ${item1.name} dan ${item2.name}, ada meja kosong hari ini?` },
            }
          : {
              label: '📅 Booking Meja Besok',
              action: 'book_tomorrow',
              payload: { message: 'Saya mau reservasi meja untuk besok' },
            },
      ];
    } else if (scoredMatches.length === 1) {
      const bestMatch = scoredMatches[0].item;
      return [
        {
          label: `📦 Bungkus 1 ${bestMatch.name}`,
          action: 'order_takeaway',
          payload: { menuName: bestMatch.name, message: `Saya mau pesan bungkus 1 porsi ${bestMatch.name}` },
        },
        isOpen
          ? {
              label: `🍽️ Makan di Tempat`,
              action: 'order_dinein',
              payload: { menuName: bestMatch.name, message: `Saya mau makan di tempat pesan ${bestMatch.name}, ada meja kosong hari ini?` },
            }
          : {
              label: `📅 Booking Meja Besok`,
              action: 'book_tomorrow',
              payload: { message: `Saya mau reservasi meja untuk besok makan ${bestMatch.name}` },
            },
        {
          label: `🥤 Rekomendasi Minuman`,
          action: 'ask_drinks',
          payload: { message: `Apa minuman yang pas dipadukan dengan ${bestMatch.name}?` },
        },
      ];
    }

    // 4. Intent: Asking for takeaway without specific dish
    if (lowerUser.includes('bungkus') || lowerUser.includes('take away') || lowerUser.includes('takeaway')) {
      const popularItems = availableMenu.filter((m) => m.isPopular);
      const suggestions = popularItems.length > 0 ? popularItems.slice(0, 2) : availableMenu.slice(0, 2);

      const buttons: ActionButton[] = suggestions.map((s) => ({
        label: `🍛 Bungkus ${s.name}`,
        action: 'order_takeaway',
        payload: { menuName: s.name, message: `Saya mau pesan bungkus 1 porsi ${s.name}` },
      }));
      buttons.push({ label: '🥘 Lihat Menu Lengkap', action: 'show_menu' });
      return buttons;
    }

    // 5. Dynamic Beverage Discovery based on tenant categories
    const drinkItems = availableMenu.filter(
      (m) =>
        m.category.toLowerCase().includes('minum') ||
        m.category.toLowerCase().includes('beverage') ||
        m.category.toLowerCase().includes('drink')
    );

    if (lowerUser.includes('minum') || lowerReply.includes('minuman')) {
      const buttons: ActionButton[] = drinkItems.slice(0, 2).map((d) => ({
        label: `🥤 ${d.name}`,
        action: 'order_takeaway',
        payload: { message: `Berapa harga ${d.name}?` },
      }));
      buttons.push({ label: '🥘 Lauk Makanan Favorit', action: 'show_menu' });
      return buttons;
    }

    // 6. Intent: VIP Room
    if (lowerUser.includes('vip') || lowerReply.includes('vip')) {
      return [
        { label: '👑 Booking Ruang VIP', action: 'ask_vip_booking', payload: { message: 'Saya mau reservasi ruangan VIP untuk acara' } },
        { label: '🥘 Menu Paket Rombongan', action: 'show_menu' },
      ];
    }

    // 7. Intent: Operating Hours & Location
    if (lowerUser.includes('alamat') || lowerUser.includes('buka') || lowerUser.includes('jam') || lowerReply.includes('operasional')) {
      // If customer has an active calculated order, guide them directly to payment / order completion
      if (session?.metadata?.activeOrder) {
        const ao = session.metadata.activeOrder;
        const totalAmt = ao.total || 0;
        return [
          {
            label: totalAmt > 0 ? `💳 Lanjut ke Pembayaran (Rp ${Number(totalAmt).toLocaleString('id-ID')})` : '💳 Lanjut ke Pembayaran',
            action: 'proceed_payment',
            payload: { message: 'Saya mau lanjut ke pembayaran pesanan ini' },
          },
          { label: '🥤 Tambah Minuman Segar', action: 'ask_drinks' },
          { label: '❌ Batalkan Pesanan', action: 'cancel_order', payload: { message: 'Batalkan pesanan saya' } },
        ];
      }

      return [
        isOpen
          ? { label: '🪑 Cek Meja Kosong Hari Ini', action: 'check_tables' }
          : { label: '📅 Booking Meja untuk Besok', action: 'book_tomorrow', payload: { message: 'Saya mau reservasi meja untuk besok' } },
        { label: '🥘 Menu Favorit Autentik', action: 'show_menu' },
      ];
    }

    // 8. General AI Question Prompt (e.g. "Mau makan di tempat atau dibungkus?")
    if (lowerReply.includes('makan di tempat') || lowerReply.includes('dibungkus')) {
      return [
        { label: '📦 Mau Dibungkus (Take Away)', action: 'takeaway_intent', payload: { message: 'Saya mau dibungkus (take away)' } },
        isOpen
          ? { label: '🍽️ Mau Makan di Tempat', action: 'dinein_intent', payload: { message: 'Saya mau makan di tempat, ada meja kosong?' } }
          : { label: '📅 Mau Booking untuk Besok', action: 'book_tomorrow', payload: { message: 'Saya mau reservasi meja untuk besok' } },
      ];
    }

    // If active takeaway order is present in session, prioritize payment actions
    if (session?.metadata?.activeOrder) {
      const ao = session.metadata.activeOrder;
      const totalAmt = ao.total || 0;
      return [
        {
          label: totalAmt > 0 ? `💳 Lanjut ke Pembayaran (Rp ${Number(totalAmt).toLocaleString('id-ID')})` : '💳 Lanjut ke Pembayaran',
          action: 'proceed_payment',
          payload: { message: 'Saya mau lanjut ke pembayaran pesanan ini' },
        },
        { label: '📍 Lokasi & Jam Ambil', action: 'show_hours' },
        { label: '🥤 Tambah Minuman Segar', action: 'ask_drinks' },
      ];
    }

    // 9. Default Starter Action Chips (Operating hours sensitive)
    return [
      { label: '🥘 Menu Favorit Autentik', action: 'show_menu' },
      isOpen
        ? { label: '🪑 Cek Meja Kosong', action: 'check_tables' }
        : { label: '📅 Booking Meja Besok', action: 'book_tomorrow', payload: { message: 'Saya mau reservasi meja untuk besok' } },
      { label: '👑 Ruangan VIP', action: 'ask_vip' },
    ];
  }
}
