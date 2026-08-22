import { restaurantAITools } from './ai-tools';
import { MenuItem, Reservation } from '../types/restaurant';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  toolCall?: {
    name: string;
    params?: any;
    result?: any;
  };
  actionButtons?: Array<{
    label: string;
    action: string;
    payload?: any;
  }>;
}

export async function processAIChat(
  userMessage: string,
  history: ChatMessage[],
  pendingConfirmation?: any
): Promise<{
  reply: string;
  toolCall?: { name: string; params?: any; result?: any };
  pendingConfirmation?: any;
  actionButtons?: Array<{ label: string; action: string; payload?: any }>;
}> {
  const text = userMessage.trim().toLowerCase();

  // 1. Handle confirmation step if pending
  if (pendingConfirmation) {
    if (
      text.includes('ya') ||
      text.includes('setuju') ||
      text.includes('oke') ||
      text.includes('ok') ||
      text.includes('lanjut') ||
      text.includes('benar') ||
      text.includes('konfirmasi')
    ) {
      // Execute the pending reservation
      const res = restaurantAITools.create_reservation(pendingConfirmation);
      if (res.success) {
        const r = res.data as Reservation;
        return {
          reply: `🎉 **Reservasi Berhasil Dikonfirmasi Otomatis oleh Sistem!**\n\n- **Kode Reservasi:** \`${r.code}\`\n- **Nama:** ${r.customerName}\n- **Waktu:** ${r.date} pukul ${r.time} WIB\n- **Meja:** ${r.tableNumber} (${r.tableArea})\n- **Jumlah Tamu:** ${r.guestCount} Orang\n- **Status:** ✅ **Terkonfirmasi (Slot Meja Terkunci)**\n\nMeja Anda telah diamankan otomatis oleh sistem tanpa perlu menunggu lama. Silakan tunjukkan kode \`${r.code}\` kepada staf penyambut saat Anda tiba di restoran.`,
          toolCall: {
            name: 'create_reservation',
            params: pendingConfirmation,
            result: res,
          },
          actionButtons: [
            { label: `Lacak Tiket ${r.code}`, action: `check_code_${r.code}` },
            { label: 'Lihat Menu', action: 'show_menu' },
          ],
        };
      } else {
        return {
          reply: `❌ Maaf, pengajuan reservasi gagal: ${res.message}`,
          toolCall: {
            name: 'create_reservation',
            params: pendingConfirmation,
            result: res,
          },
        };
      }
    } else if (text.includes('batal') || text.includes('tidak') || text.includes('gak')) {
      return {
        reply: 'Baik, pengajuan reservasi dibatalkan. Ada hal lain yang bisa saya bantu terkait menu atau informasi restoran?',
      };
    }
  }

  // 2. Cancellation Intent
  if (text.includes('batal') && (text.includes('rm-') || text.includes('reservasi'))) {
    const match = text.match(/rm-[a-z0-9]{4}/i);
    if (match) {
      const code = match[0].toUpperCase();
      const res = restaurantAITools.cancel_reservation(code);
      return {
        reply: res.success
          ? `✅ **Reservasi ${code} Berhasil Dibatalkan.**\n\n${res.message}`
          : `⚠️ Gagal membatalkan: ${res.message}`,
        toolCall: { name: 'cancel_reservation', params: { code }, result: res },
      };
    }
  }

  // 3. Reschedule / Update Reservation Intent
  if ((text.includes('ubah') || text.includes('ganti') || text.includes('geser') || text.includes('pindah') || text.includes('reschedule')) && text.includes('rm-')) {
    const match = text.match(/rm-[a-z0-9]{4}/i);
    if (match) {
      const code = match[0].toUpperCase();
      
      // Extract new date / time if provided
      let newDate: string | undefined = undefined;
      const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) newDate = dateMatch[0];
      else if (text.includes('besok')) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        newDate = d.toISOString().split('T')[0];
      }

      let newTime: string | undefined = undefined;
      const timeMatch = text.match(/(\d{1,2})[:.](\d{2})/);
      if (timeMatch) newTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      else if (text.includes('malam') || text.includes('19')) newTime = '19:00';
      else if (text.includes('siang') || text.includes('13')) newTime = '13:00';

      let newGuests: number | undefined = undefined;
      const guestMatch = text.match(/(\d+)\s*(orang|tamu|pax|org)/);
      if (guestMatch) newGuests = parseInt(guestMatch[1], 10);

      if (!newDate && !newTime && !newGuests) {
        return {
          reply: `Tentu, saya dapat membantu mengubah jadwal reservasi **${code}**. Mohon beri tahu detail perubahan Anda:\n- Mau diubah ke tanggal berapa?\n- Pukul berapa?\n- Dan untuk berapa tamu?`,
        };
      }

      const res = restaurantAITools.update_reservation({
        code,
        newDate,
        newTime,
        newGuestCount: newGuests,
      });

      return {
        reply: res.success
          ? `✅ **Jadwal Reservasi ${code} Berhasil Diperbarui!**\n\n${res.message}\n\nStatus kembali berstatus *Pending* untuk penyesuaian staf dapur.`
          : `⚠️ Gagal memperbarui jadwal: ${res.message}`,
        toolCall: {
          name: 'update_reservation',
          params: { code, newDate, newTime, newGuests },
          result: res,
        },
        actionButtons: [
          { label: `Cek Status ${code}`, action: `check_code_${code}` },
        ],
      };
    }
  }

  // 4. Check Reservation Status by Code
  const codeMatch = text.match(/rm-[a-z0-9]{4}/i);
  if (codeMatch && (text.includes('cek') || text.includes('status') || text.includes('lihat') || text.includes('kode') || text.length <= 10)) {
    const code = codeMatch[0].toUpperCase();
    const res = restaurantAITools.get_reservation(code);
    if (res.success) {
      const r = res.data as Reservation;
      const statusIndo: Record<string, string> = {
        pending: '⏳ Menunggu Pembayaran',
        confirmed: '✅ Terkonfirmasi Otomatis (Meja Terkunci)',
        seated: '🍽️ Sedang Bersantap (Seated)',
        completed: '⭐ Selesai Bersantap',
        rejected: '❌ Ditolak',
        cancelled: '⚪ Dibatalkan',
        no_show: '⚠️ Tidak Hadir (No-Show)',
        expired: '⏱️ Kadaluarsa (Expired)',
      };
      const currentStatusText = statusIndo[r.status] || r.status;

      return {
        reply: `📋 **Status Reservasi ${r.code}:**\n\n- **Nama Pemesan:** ${r.customerName}\n- **Kontak:** ${r.customerPhone}\n- **Tanggal & Waktu:** ${r.date} jam ${r.time} WIB\n- **Meja:** ${r.tableNumber} (${r.tableArea})\n- **Jumlah Tamu:** ${r.guestCount} Orang\n- **Status Terkini:** ${currentStatusText}${r.notes ? `\n- **Catatan:** ${r.notes}` : ''}${r.rejectionReason ? `\n- **Keterangan:** ${r.rejectionReason}` : ''}`,
        toolCall: { name: 'get_reservation', params: { code }, result: res },
        actionButtons:
          r.status === 'pending' || r.status === 'confirmed'
            ? [
                { label: `Batalkan Reservasi ${r.code}`, action: `cancel_${r.code}` },
                { label: `Ubah Jadwal ${r.code}`, action: `reschedule_${r.code}` },
              ]
            : undefined,
      };
    } else {
      return {
        reply: `⚠️ ${res.message}`,
        toolCall: { name: 'get_reservation', params: { code }, result: res },
      };
    }
  }

  // 5. Restaurant Info / FAQ Intent
  if (
    text.includes('alamat') ||
    text.includes('lokasi') ||
    text.includes('jam buka') ||
    text.includes('buka jam') ||
    text.includes('tutup') ||
    text.includes('kontak') ||
    text.includes('telepon') ||
    text.includes('kebijakan') ||
    text.includes('tentang') ||
    text.includes('profil')
  ) {
    const res = restaurantAITools.get_restaurant_info();
    const p = res.data;
    return {
      reply: `🏠 **${p.name}** — ${p.tagline}\n\n📍 **Alamat:** ${p.address}, ${p.city}\n🕒 **Jam Operasional:** ${p.openingHours}\n📞 **Kontak WhatsApp/Telp:** ${p.phone}\n\nℹ️ **Kebijakan & Fasilitas:**\n${p.policies.map((pol: string) => `• ${pol}`).join('\n')}`,
      toolCall: { name: 'get_restaurant_info', result: res },
      actionButtons: [
        { label: 'Lihat Daftar Menu', action: 'show_menu' },
        { label: 'Cek Ketersediaan Meja', action: 'check_tables' },
      ],
    };
  }

  // 6. Menu Search & Inquiries
  if (
    text.includes('menu') ||
    text.includes('makanan') ||
    text.includes('minuman') ||
    text.includes('harga') ||
    text.includes('rendang') ||
    text.includes('ayam pop') ||
    text.includes('dendeng') ||
    text.includes('gulai') ||
    text.includes('sambal') ||
    text.includes('teh talua') ||
    text.includes('pedas')
  ) {
    let category: string | undefined = undefined;
    if (text.includes('minum')) category = 'Minuman';
    else if (text.includes('sayur') || text.includes('kuah')) category = 'Sayur & Kuah';
    else if (text.includes('sambal') || text.includes('pelengkap')) category = 'Pelengkap & Sambal';
    else if (text.includes('lauk') || text.includes('utama')) category = 'Lauk Utama';

    let searchKeyword = '';
    const keywords = ['rendang', 'ayam pop', 'dendeng', 'tunjang', 'kakap', 'singkong', 'pakis', 'teh talua', 'tebak', 'timun'];
    for (const kw of keywords) {
      if (text.includes(kw)) {
        searchKeyword = kw;
        break;
      }
    }

    const res = restaurantAITools.get_menu(category, searchKeyword);
    const items = res.data as MenuItem[];

    if (items.length === 0) {
      return {
        reply: `Maaf, tidak ditemukan menu yang sesuai dengan pencarian "${searchKeyword || text}". Silakan tanyakan menu andalan kami seperti Rendang, Ayam Pop, atau Dendeng Balado.`,
        toolCall: { name: 'get_menu', params: { category, search: searchKeyword }, result: res },
      };
    }

    const formatPrice = (p: number) => `Rp${p.toLocaleString('id-ID')}`;
    const formattedList = items
      .slice(0, 6)
      .map(
        (m) =>
          `• **${m.name}** — ${formatPrice(m.price)} ${m.isAvailable ? '✅ *(Tersedia)*' : '❌ *(Habis)*'}\n  *${m.description}*`
      )
      .join('\n\n');

    return {
      reply: `🍽️ **Daftar Menu Raso Minang:**\n\n${formattedList}${items.length > 6 ? `\n\n*(dan ${items.length - 6} menu lainnya...)*` : ''}`,
      toolCall: { name: 'get_menu', params: { category, search: searchKeyword }, result: res },
      actionButtons: [
        { label: 'Pesan Meja Sekarang', action: 'book_table' },
        { label: 'Cek Menu Minuman', action: 'menu_minuman' },
      ],
    };
  }

  // 7. Availability Check / Booking Flow extraction
  if (
    text.includes('reservasi') ||
    text.includes('booking') ||
    text.includes('pesan meja') ||
    text.includes('tersedia') ||
    text.includes('ada meja') ||
    text.includes('kosong')
  ) {
    // If text is super generic (e.g. "saya mau reservasi", "bisa booking?") without specifics:
    const hasSpecificDetails =
      text.includes('orang') ||
      text.includes('pax') ||
      text.includes('tamu') ||
      text.includes('jam') ||
      text.includes(':') ||
      text.includes('besok') ||
      text.includes('hari ini') ||
      text.includes('malam') ||
      text.includes('siang');

    if (!hasSpecificDetails && (text.includes('mau reservasi') || text.includes('bisa booking') || text.includes('pesan meja'))) {
      return {
        reply: `Tentu! Saya siap membantu reservasi meja di **Raso Minang** 🍛.\n\nAgar saya bisa mencarikan meja yang tepat, mohon informasikan:\n1. 📅 **Tanggal kedatangan** (misal: *Hari ini* atau *Besok*)\n2. ⏰ **Jam kedatangan** (antara pukul *10.00 – 21.00 WIB*)\n3. 👥 **Jumlah tamu** (misal: *4 orang*)\n4. 🪑 **Preferensi area** (*Indoor AC*, *Outdoor*, atau *VIP Room*)`,
        actionButtons: [
          { label: 'Hari Ini 2 Orang (12:30)', action: 'quick_book_lunch' },
          { label: 'Hari Ini 4 Orang (19:00)', action: 'quick_book_dinner' },
        ],
      };
    }

    // Try to extract date, time, guest count
    const today = new Date().toISOString().split('T')[0];
    let date = today;
    if (text.includes('besok')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      date = d.toISOString().split('T')[0];
    } else {
      const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) date = dateMatch[0];
    }

    let time = '12:30';
    const timeMatch = text.match(/(\d{1,2})[:.](\d{2})/);
    if (timeMatch) {
      time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    } else if (text.includes('malam') || text.includes('19')) {
      time = '19:00';
    } else if (text.includes('siang') || text.includes('12')) {
      time = '12:30';
    }

    let guests = 2;
    const guestMatch = text.match(/(\d+)\s*(orang|tamu|pax|org|meja)/);
    if (guestMatch) {
      guests = parseInt(guestMatch[1], 10);
    }

    // Check area preference
    let area: string | undefined = undefined;
    if (text.includes('vip')) area = 'VIP';
    else if (text.includes('outdoor') || text.includes('luar')) area = 'Outdoor';
    else if (text.includes('indoor') || text.includes('dalam')) area = 'Indoor';

    const avail = restaurantAITools.check_availability({
      date,
      time,
      guestCount: guests,
      preferredArea: area,
    });

    if (!avail.success) {
      return {
        reply: `⚠️ **Ketersediaan Meja:**\n\n${avail.message}\n\nSilakan coba pilih jam lain antara 10:00 - 21:00 WIB atau kurangi jumlah tamu per meja.`,
        toolCall: {
          name: 'check_availability',
          params: { date, time, guestCount: guests, preferredArea: area },
          result: avail,
        },
      };
    }

    // If customer also provided a name/phone in text, offer confirmation
    const nameMatch = text.match(/(?:nama|atas nama|nama saya)\s+([a-zA-Z\s]{3,20})/i);
    const phoneMatch = text.match(/(?:08\d{8,11}|628\d{8,11})/);

    const customerName = nameMatch ? nameMatch[1].trim() : 'Customer';
    const customerPhone = phoneMatch ? phoneMatch[0] : '081234567890';

    const pendingData = {
      customerName,
      customerPhone,
      date,
      time,
      guestCount: guests,
      preferredArea: area,
      notes: 'Diajukan via AI Assistant',
    };

    return {
      reply: `✨ **Meja Tersedia & Siap Dikunci!**\n\nKami menemukan meja yang cocok untuk **${guests} orang** pada tanggal **${date}** pukul **${time} WIB** (${avail.data.availableTables.length} pilihan meja tersedia).\n\nApakah Anda ingin sistem langsung mengonfirmasi dan mengunci meja ini untuk Anda?\n- **Nama:** ${customerName}\n- **Kontak:** ${customerPhone}\n- **Waktu:** ${date}, ${time} WIB\n- **Jumlah:** ${guests} Orang\n\nKetik **"Ya, Konfirmasi"** untuk menerbitkan tiket reservasi instan (*Auto-Confirmed by System*).`,
      toolCall: {
        name: 'check_availability',
        params: { date, time, guestCount: guests, preferredArea: area },
        result: avail,
      },
      pendingConfirmation: pendingData,
      actionButtons: [
        { label: '✅ Ya, Kunci Meja Sekarang', action: 'confirm_pending_booking' },
        { label: '❌ Batal', action: 'cancel_booking_prompt' },
      ],
    };
  }

  // 8. General Friendly Fallback Grounded in Restaurant Facts
  return {
    reply: `Halo! Saya asisten virtual **Raso Minang** 🍛.\n\nSaya siap membantu Anda dengan:\n1. 📜 **Melihat Menu & Harga** (misal: *"Berapa harga Rendang?"* atau *"Ada menu ayam apa saja?"*)\n2. 🪑 **Cek Ketersediaan Meja** (misal: *"Ada meja untuk 4 orang besok jam 19.00?"*)\n3. 📝 **Buat, Ubah & Lacak Reservasi** (misal: *"Cek status reservasi RM-1001"* atau *"Ubah jam RM-1001 jadi jam 19.00"*)\n4. 🕒 **Informasi Restoran & Jam Buka**\n\nAda yang bisa saya bantu hari ini?`,
    actionButtons: [
      { label: 'Lihat Menu Favorit', action: 'show_menu' },
      { label: 'Cek Ketersediaan Meja', action: 'check_tables' },
      { label: 'Cek Status Reservasi', action: 'track_reservation' },
    ],
  };
}
