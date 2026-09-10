import { ConversationSession, AIMessage } from './types';
import { RestaurantProfile, Customer, MenuItem } from '../domain/types';

export interface AssembledContext {
  systemPrompt: string;
  operationalFacts: string;
  customerMemory: string;
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  totalEstimatedTokens: number;
}

export class ContextEngine {
  /**
   * Approximate token count for Indonesian text (avg ~3.5 chars per token)
   */
  public static estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Assemble complete prompt context for the AI model respecting token budgets
   */
  public static buildContext(params: {
    session: ConversationSession;
    profile: RestaurantProfile;
    customer?: Customer | null;
    menuSnapshot?: MenuItem[];
    availableTablesCount?: number;
    maxHistoryTokens?: number;
  }): AssembledContext {
    const {
      session,
      profile,
      customer,
      menuSnapshot = [],
      availableTablesCount = 0,
      maxHistoryTokens = 1500,
    } = params;

    // 1. System & Brand Persona
    const systemPrompt = `Kamu adalah Asisten AI Virtual resmi untuk "${profile.name}".
GAYA BICARA & ATURAN UTAMA:
- WAJIB SINGKAT, PADAT, & ON-POINT (Maksimal 2-3 kalimat atau bullet point ringkas). Pelanggan ingin jawaban cepat dan instan.
- JANGAN BERTELE-TELE / JANGAN BASA-BASI: DILARANG membuat kalimat penundaan seperti "saya cekkan dulu", "sebentar saya lihat", dsb.
- SELURUH DATA MENU SUDAH TERSEDIA LENGKAP di bagian [KATALOG MENU LENGKAP SAAT INI] di bawah. Jika pelanggan bertanya menu/harga/rekomendasi/minuman, LANGSUNG JAWAB seketika menggunakan data tersebut tanpa memanggil tool get_menu.
- LANGSUNG KE AKSI (ACTION-ORIENTED):
  * Jika tanya menu/harga: langsung sebutkan nama menu, harga (Rp), dan rekomendasi singkat dari katalog.
  * Jika booking meja: panggil tool request_reservation_hold untuk mengamankan meja.
  * Jika cek tiket reservasi: panggil tool get_reservation.
  * Jika take away / pesan bungkus:
    - ATURAN KUANTITAS/PORSI: Jika pelanggan TIDAK menyebutkan angka porsi secara spesifik (misal hanya berkata "Bungkus Rendang"), JUMLAH WAJIB DIANGGAP 1 PORSI (quantity: 1). DILARANG mengasumsikan 2 porsi atau lebih tanpa permintaan tegas dari pelanggan!
    - Jika pelanggan SUDAH menyebutkan nama menu: panggil tool calculate_order_total untuk menghitung rincian total dan pajak (default quantity: 1 jika tidak disebut).
    - Jika pelanggan menanyakan alamat/jam buka saat ADA pesanan aktif: Jawab alamat/jam buka secara singkat dan langsung ajak: "Mau langsung lanjut pembayaran untuk pesanan bungkus Kakak?"
    - Jika pelanggan ingin lanjut bayar/checkout ("lanjut bayar", "bayar sekarang", "proses pesanan", "mau bayar", "ya"): LANGSUNG panggil tool create_takeaway_order. Jika pelanggan belum menyebutkan nama/nomor HP, gunakan default 'Pelanggan Raso Minang' dan nomor '-'. DILARANG menunda pembuatan pesanan hanya untuk menanyakan data jika pelanggan sudah ingin membayar!
- Sapa dengan ramah dan sopan (Kak / Uda / Uni).
- DILARANG mengarang harga atau menu yang tidak ada di katalog.`;

    // 2. Live Operational Facts (Full Grounded Menu & Realtime Store Data)
    const fullMenuCatalog = menuSnapshot
      .filter((m) => m.isAvailable)
      .map((m) => `• ${m.name} (${m.category}) - Rp ${m.price.toLocaleString('id-ID')}${m.isPopular ? ' [FAVORIT]' : ''}: ${m.description}`)
      .join('\n');

    let activeOrderContext = '';
    if (session.metadata?.activeOrder) {
      const ao = session.metadata.activeOrder;
      const itemsStr = ao.detailedItems?.map((d: any) => `${d.quantity}x ${d.name}`).join(', ') || 'Item makanan';
      activeOrderContext = `\n\n[PESANAN AKTIF SAAT INI (DALAM PROSES)]\n- Status: Siap lanjut ke pembayaran\n- Item: ${itemsStr}\n- Total: Rp ${Number(ao.total || 0).toLocaleString('id-ID')}\n- PANDUAN: Bimbing pelanggan segera menyelesaikan pembayaran (panggil create_takeaway_order jika pelanggan setuju/mau bayar).`;
    }

    const operationalFacts = `[FAKTA OPERASIONAL REALTIME]
- Restoran: ${profile.name} (${profile.address}, ${profile.city})
- Jam Buka: ${profile.openTime} – ${profile.closeTime} WIB (Status: ${profile.openingHours})
- Kontak WhatsApp: ${profile.phone}
- Ketersediaan Meja Saat Ini: ${availableTablesCount > 0 ? `${availableTablesCount} meja siap dipesan` : 'Sistem booking aktif'}${activeOrderContext}

[KATALOG MENU LENGKAP SAAT INI (DATA GROUNDED RESMI)]
${fullMenuCatalog || 'Semua menu tersedia di katalog.'}`;

    // 3. Customer Profile & Long-Term Memory
    let customerMemory = '[PROFIL & PREFERENSI PELANGGAN]\n- Status: Tamu Baru';
    if (customer) {
      const prefs = customer.preferences || {};
      customerMemory = `[PROFIL & PREFERENSI PELANGGAN]
- Nama: ${customer.name} (${customer.phone})
- Riwayat Reservasi: ${customer.reservationCount} kali kunjungan
- Preferensi Rasa: ${prefs.spicyLevel ? `Level Pedas: ${prefs.spicyLevel}` : 'Normal'}
- Pantangan/Alergi: ${prefs.dietaryRestrictions?.join(', ') || 'Tidak ada'}
- Area Favorit: ${prefs.preferredArea || 'Bebas'}`;
    }

    // 4. Conversation History with Sliding Window & Token Budgeting
    const rawHistory = session.history || [];
    const formattedHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

    // Include context summary if available from older turns
    if (session.contextSummary) {
      formattedHistory.push({
        role: 'system',
        content: `[RINGKASAN PERCAKAPAN SEBELUMNYA]: ${session.contextSummary}`,
      });
    }

    // Process recent messages from newest backwards up to token budget
    let currentHistoryTokens = 0;
    const recentMessages: AIMessage[] = [];

    for (let i = rawHistory.length - 1; i >= 0; i--) {
      const msg = rawHistory[i];
      const tokens = this.estimateTokens(msg.text);
      if (currentHistoryTokens + tokens > maxHistoryTokens) break;
      recentMessages.unshift(msg);
      currentHistoryTokens += tokens;
    }

    for (const msg of recentMessages) {
      formattedHistory.push({
        role: msg.sender === 'assistant' ? 'assistant' : msg.sender === 'user' ? 'user' : 'system',
        content: msg.text,
      });
    }

    const totalEstimatedTokens =
      this.estimateTokens(systemPrompt) +
      this.estimateTokens(operationalFacts) +
      this.estimateTokens(customerMemory) +
      currentHistoryTokens;

    return {
      systemPrompt,
      operationalFacts,
      customerMemory,
      conversationHistory: formattedHistory,
      totalEstimatedTokens,
    };
  }

  /**
   * Compact old conversation turns into a short summary
   */
  public static summarizeHistory(messages: AIMessage[]): string {
    if (messages.length === 0) return '';
    const userTopics = messages
      .filter((m) => m.sender === 'user')
      .map((m) => m.text.slice(0, 40))
      .join('; ');
    return `Pelanggan sebelumnya menanyakan: ${userTopics.slice(0, 150)}...`;
  }
}
