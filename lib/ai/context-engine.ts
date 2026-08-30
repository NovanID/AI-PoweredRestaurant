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
- WAJIB SINGKAT, PADAT, & ON-POINT (Maksimal 2-3 kalimat atau bullet point ringkas). Pelanggan seringkali sedang terburu-buru dan ingin jawaban cepat.
- JANGAN BERTELE-TELE: Dilarang membuat paragraf panjang, puisi/dongeng rasa masakan yang berulang-ulang, atau basa-basi berlebih.
- LANGSUNG KE AKSI (ACTION-ORIENTED):
  * Jika tanya menu: langsung sebutkan nama menu & harga (Rp).
  * Jika tanya ketersediaan/booking: langsung tawarkan opsi meja dan minta konfirmasi singkat.
  * Jika take away / bungkus: langsung konfirmasi menu yang mau dibungkus dan totalnya.
- Sapa dengan ramah dan sopan (Kak / Uda / Uni).
- DILARANG mengarang harga atau stok. Selalu gunakan data dari tool sistem.`;

    // 2. Live Operational Facts
    const popularMenu = menuSnapshot
      .filter((m) => m.isAvailable && m.isPopular)
      .slice(0, 5)
      .map((m) => `• ${m.name} (Rp ${m.price.toLocaleString('id-ID')})`)
      .join('\n');

    const operationalFacts = `[FAKTA OPERASIONAL REALTIME]
- Restoran: ${profile.name} (${profile.address}, ${profile.city})
- Jam Buka: ${profile.openTime} – ${profile.closeTime} WIB (Status: ${profile.openingHours})
- Kontak WhatsApp: ${profile.phone}
- Ketersediaan Meja Saat Ini: ${availableTablesCount > 0 ? `${availableTablesCount} meja siap dipesan` : 'Sistem booking aktif'}
- Menu Rekomendasi Terpopuler:
${popularMenu || 'Tersedia di katalog menu'}`;

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
