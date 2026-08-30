import { IntentType, ConversationSession } from './types';

export interface DecisionResult {
  intent: IntentType;
  confidence: number;
  extractedEntities: Record<string, any>;
  recommendedTool?: string;
  toolArgs?: Record<string, any>;
}

export class DecisionEngine {
  /**
   * Fast Intent & Entity Extraction Engine
   */
  public static evaluate(userText: string, session: ConversationSession): DecisionResult {
    const text = userText.trim().toLowerCase();
    const entities: Record<string, any> = {};

    // 1. Check for active pending action confirmation/rejection
    if (session.pendingAction) {
      if (
        text.includes('ya') ||
        text.includes('setuju') ||
        text.includes('oke') ||
        text.includes('ok') ||
        text.includes('lanjut') ||
        text.includes('benar') ||
        text.includes('konfirmasi')
      ) {
        return {
          intent: 'CONFIRM_ACTION',
          confidence: 0.98,
          extractedEntities: { actionId: session.pendingAction.id },
          recommendedTool:
            session.pendingAction.type === 'CONFIRM_RESERVATION'
              ? 'confirm_reservation'
              : undefined,
          toolArgs: {
            leaseToken: session.pendingAction.leaseToken,
            customerName: session.pendingAction.payload.customerName,
            customerPhone: session.pendingAction.payload.customerPhone,
            notes: session.pendingAction.payload.notes,
            idempotencyKey: `idem_res_${session.pendingAction.leaseToken}`,
          },
        };
      }

      if (text.includes('batal') || text.includes('tidak') || text.includes('gak') || text.includes('nggak')) {
        return {
          intent: 'CANCEL_ACTION',
          confidence: 0.95,
          extractedEntities: { actionId: session.pendingAction.id },
        };
      }
    }

    // 2. Cancellation Intent with Code (e.g. "Batal reservasi RM-1024")
    const codeMatch = text.match(/rm-[a-z0-9]{4}/i);
    if (text.includes('batal') && codeMatch) {
      const code = codeMatch[0].toUpperCase();
      return {
        intent: 'CANCEL_ACTION',
        confidence: 0.95,
        extractedEntities: { code },
        recommendedTool: 'cancel_reservation',
        toolArgs: { code, reason: 'Dibatalkan oleh pelanggan via chat' },
      };
    }

    // 3. Reschedule / Update Intent
    if (
      (text.includes('ubah') || text.includes('ganti') || text.includes('geser') || text.includes('pindah') || text.includes('reschedule')) &&
      codeMatch
    ) {
      const code = codeMatch[0].toUpperCase();
      const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
      const timeMatch = text.match(/\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b/);
      const paxMatch = text.match(/(\d+)\s*(orang|tamu|pax|org)/);

      return {
        intent: 'UPDATE_RESERVATION',
        confidence: 0.92,
        extractedEntities: { code, date: dateMatch?.[0], time: timeMatch?.[0], pax: paxMatch?.[1] },
        recommendedTool: 'update_reservation',
        toolArgs: {
          code,
          newDate: dateMatch?.[0],
          newTime: timeMatch?.[0],
          newGuestCount: paxMatch ? parseInt(paxMatch[1], 10) : undefined,
        },
      };
    }

    // 4. Ticket Status Check (e.g. "Cek tiket RM-1024" or just "RM-1024")
    if (codeMatch) {
      const code = codeMatch[0].toUpperCase();
      return {
        intent: 'CHECK_RESERVATION',
        confidence: 0.96,
        extractedEntities: { code },
        recommendedTool: 'get_reservation',
        toolArgs: { code },
      };
    }

    // 5. Booking / Availability Intent
    const hasBookingKeywords =
      text.includes('pesan meja') ||
      text.includes('booking') ||
      text.includes('reservasi') ||
      text.includes('meja kosong') ||
      text.includes('ada meja') ||
      text.includes('cek meja');

    if (hasBookingKeywords) {
      // Extract Date, Time, Pax
      const paxMatch = text.match(/(\d+)\s*(orang|tamu|pax|org|orgs)/);
      const pax = paxMatch ? parseInt(paxMatch[1], 10) : 2;

      let date = new Date().toISOString().split('T')[0];
      if (text.includes('besok')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        date = tomorrow.toISOString().split('T')[0];
      } else if (text.includes('lusa')) {
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);
        date = dayAfter.toISOString().split('T')[0];
      }

      const timeMatch = text.match(/\b([01]?[0-9]|2[0-3])[:.]([0-5][0-9])\b/) || text.match(/jam\s*(\d{1,2})/);
      let time = '19:00';
      if (timeMatch) {
        if (timeMatch[1] && timeMatch[2]) {
          time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        } else if (timeMatch[1]) {
          time = `${timeMatch[1].padStart(2, '0')}:00`;
        }
      }

      let preferredArea: 'Indoor' | 'Outdoor' | 'VIP' | undefined = undefined;
      if (text.includes('vip')) preferredArea = 'VIP';
      else if (text.includes('outdoor')) preferredArea = 'Outdoor';
      else if (text.includes('indoor')) preferredArea = 'Indoor';

      // If user provided name (e.g. "atas nama Budi")
      const nameMatch = text.match(/atas nama\s+([a-zA-Z\s]+)/i);
      const customerName = nameMatch ? nameMatch[1].trim() : session.customerName || 'Tamu';

      return {
        intent: 'CREATE_RESERVATION',
        confidence: 0.94,
        extractedEntities: { date, time, pax, preferredArea, customerName },
        recommendedTool: 'request_reservation_hold',
        toolArgs: {
          customerName,
          date,
          time,
          guestCount: pax,
          preferredArea,
          notes: 'Dipesan via AI Assistant',
        },
      };
    }

    // 6. Menu / Recommendation Queries
    if (
      text.includes('menu') ||
      text.includes('makan') ||
      text.includes('minum') ||
      text.includes('pedas') ||
      text.includes('rendang') ||
      text.includes('ayam') ||
      text.includes('harga') ||
      text.includes('rekomendasi')
    ) {
      let spicinessLevel: number | undefined = undefined;
      if (text.includes('pedas banget') || text.includes('sangat pedas')) spicinessLevel = 3;
      else if (text.includes('pedas')) spicinessLevel = 2;

      let maxPrice: number | undefined = undefined;
      const budgetMatch = text.match(/budget\s*(?:saya|kami)?\s*(\d+)\s*(?:rb|ribu|k)?/i);
      if (budgetMatch) {
        let val = parseInt(budgetMatch[1], 10);
        if (val < 1000) val = val * 1000;
        maxPrice = val;
      }

      return {
        intent: 'RECOMMENDATION',
        confidence: 0.93,
        extractedEntities: { spicinessLevel, maxPrice },
        recommendedTool: 'get_menu',
        toolArgs: {
          category: 'Semua',
          search: text.includes('rendang') ? 'rendang' : text.includes('ayam') ? 'ayam' : undefined,
          maxPrice,
          spicinessLevel,
        },
      };
    }

    // 7. Human Escalation / Complaint
    if (text.includes('manusia') || text.includes('operator') || text.includes('admin') || text.includes('komplain') || text.includes('kecewa')) {
      return {
        intent: 'HUMAN_HANDOFF',
        confidence: 0.95,
        extractedEntities: { reason: userText },
        recommendedTool: 'contact_human',
        toolArgs: { reason: userText },
      };
    }

    // Default General Query
    return {
      intent: 'GENERAL_CHAT',
      confidence: 0.85,
      extractedEntities: {},
    };
  }
}
