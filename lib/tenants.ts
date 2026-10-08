/**
 * Tenant Registry — canonical mapping between tenantId, public slug, code prefix,
 * and storefront branding. Single source of truth for tenant metadata that is NOT
 * stored in PostgreSQL (URL slug, reservation code prefix, UI theme/copywriting).
 */
import {
  DEFAULT_TENANT_ID,
  TENANT_RASO_MINANG,
  TENANT_KOPI_NUSANTARA,
} from './mock-data';

export { DEFAULT_TENANT_ID, TENANT_RASO_MINANG, TENANT_KOPI_NUSANTARA };

export interface TenantTheme {
  primary: string;
  primaryDark: string;
  primaryHover: string;
  accent: string;
  accentLight: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  footer: string;
}

export interface TenantBranding {
  slug: string;
  codePrefix: string;
  logoInitials: string;
  badgeText: string;
  heroBadges: string[];
  heroTitle: [string, string];
  heroDescription: string;
  navSubtitle: string;
  menuEyebrow: string;
  menuTitle: string;
  menuDescription: string;
  menuSearchPlaceholder: string;
  reservationDescription: string;
  chatWelcome: string;
  chatPersonaLabel: string;
  defaultCustomerLabel: string;
  quickPrompts: Array<{ label: string; query: string }>;
  theme: TenantTheme;
}

export const TENANT_BRANDING: Record<string, TenantBranding> = {
  [TENANT_RASO_MINANG]: {
    slug: 'raso-minang',
    codePrefix: 'RM',
    logoInitials: 'RM',
    badgeText: 'Warisan Kuliner Minangkabau Asli',
    heroBadges: ['🟢 100% Halal', '⚡ AI Real-Time Booking'],
    heroTitle: ['Rasa Minang,', 'Hangat di Setiap Meja.'],
    heroDescription:
      'Nikmati kelezatan Rendang 8 Jam, Ayam Pop Gurih, dan aneka hidangan Minang pilihan. Reservasi meja dan konsultasi menu instan dipandu oleh Asisten AI pintar kami.',
    navSubtitle: 'Restoran Padang Autentik',
    menuEyebrow: 'Pilihan Hidangan Tradisi',
    menuTitle: 'Cita Rasa Otentik Minang',
    menuDescription:
      'Semua hidangan diolah harian dengan rempah segar tanpa pengawet. Status ketersediaan diperbarui langsung oleh dapur kami.',
    menuSearchPlaceholder: 'Cari Rendang, Ayam Pop, Sambal...',
    reservationDescription:
      'Nikmati santap hidangan Minang tanpa antre. Sistem kami memastikan meja Anda dipersiapkan dengan baik sebelum kedatangan.',
    chatWelcome:
      'Halo! Saya **Asisten AI Raso Minang** 🍛.\n\nAda yang bisa saya bantu hari ini? Anda bisa menanyakan menu autentik, mengecek ketersediaan meja real-time, atau langsung memesan meja dalam 1 pesan.',
    chatPersonaLabel: 'Asisten AI Raso Minang',
    defaultCustomerLabel: 'Pelanggan Raso Minang',
    quickPrompts: [
      { label: '🪑 Meja 4 Org Besok Jam 19.00', query: 'Ada meja kosong untuk 4 orang besok jam 19.00?' },
      { label: '🥘 Rekomendasi Menu Favorit', query: 'Apa saja menu rekomendasi dan terpopuler di sini?' },
      { label: '👑 Info Ruangan VIP', query: 'Apakah ada ruangan VIP untuk acara keluarga atau kantor?' },
      { label: '💳 Cara Pembayaran DP', query: 'Bagaimana cara pembayaran deposit via QRIS/Midtrans?' },
    ],
    theme: {
      primary: '#8f1d20',
      primaryDark: '#6a1215',
      primaryHover: '#731518',
      accent: '#d8a43b',
      accentLight: '#ffd98a',
      bg: '#fffaf0',
      surface: '#f4ebe1',
      text: '#261b17',
      muted: '#74635c',
      border: '#eadfca',
      footer: '#261b17',
    },
  },
  [TENANT_KOPI_NUSANTARA]: {
    slug: 'kopi-nusantara',
    codePrefix: 'KN',
    logoInitials: 'KN',
    badgeText: 'Artisan Coffee Roastery & Modern Eatery',
    heroBadges: ['🌿 Pet-Friendly Outdoor', '⚡ AI Real-Time Booking'],
    heroTitle: ['Kopi Nusantara,', 'Seduh Hangat Setiap Cerita.'],
    heroDescription:
      'Nikmati single origin Gayo, Toraja, dan Kintamani seduhan barista, dipadu pastry artisan dan comfort food modern. Reservasi meja dan rekomendasi menu instan dipandu Asisten AI kami.',
    navSubtitle: 'Specialty Coffee & Bistro',
    menuEyebrow: 'Pilihan Menu Andalan',
    menuTitle: 'Kopi & Hidangan Artisan',
    menuDescription:
      'Biji kopi dipanggang mingguan oleh roaster in-house, pastry dibuat fresh setiap pagi. Status ketersediaan diperbarui langsung oleh barista kami.',
    menuSearchPlaceholder: 'Cari Kopi Susu, Croissant, Pasta...',
    reservationDescription:
      'Nikmati waktu santai tanpa antre. Sistem kami memastikan meja Anda — indoor ber-AC atau outdoor garden — siap sebelum kedatangan.',
    chatWelcome:
      'Halo! Saya **Asisten AI Kopi Nusantara** ☕.\n\nAda yang bisa saya bantu? Tanyakan menu kopi & makanan, cek ketersediaan meja real-time, atau langsung booking meja dalam 1 pesan.',
    chatPersonaLabel: 'Asisten AI Kopi Nusantara',
    defaultCustomerLabel: 'Pelanggan Kopi Nusantara',
    quickPrompts: [
      { label: '🪑 Meja 4 Org Besok Jam 19.00', query: 'Ada meja kosong untuk 4 orang besok jam 19.00?' },
      { label: '☕ Rekomendasi Kopi Favorit', query: 'Apa saja menu kopi rekomendasi dan terpopuler di sini?' },
      { label: '🌿 Area Outdoor Pet-Friendly', query: 'Apakah ada area outdoor yang ramah hewan peliharaan dan smoking area?' },
      { label: '💳 Cara Pembayaran DP', query: 'Bagaimana cara pembayaran deposit via QRIS/Midtrans?' },
    ],
    theme: {
      primary: '#4a2c1d',
      primaryDark: '#33200f',
      primaryHover: '#3a2214',
      accent: '#c98a3d',
      accentLight: '#e8c48a',
      bg: '#faf7f2',
      surface: '#efe8de',
      text: '#221a14',
      muted: '#6f6259',
      border: '#e3d9cc',
      footer: '#221a14',
    },
  },
};

const FALLBACK_BRANDING: TenantBranding = TENANT_BRANDING[TENANT_RASO_MINANG];

export function getTenantBranding(tenantId: string): TenantBranding {
  return TENANT_BRANDING[tenantId] || { ...FALLBACK_BRANDING, slug: tenantId };
}

/**
 * Resolve a canonical public slug (or a raw tenantId) to a tenantId.
 * Returns null when unknown.
 */
export function resolveTenantSlug(slugOrId: string): string | null {
  const clean = (slugOrId || '').trim().toLowerCase();
  if (!clean) return null;
  for (const [tenantId, branding] of Object.entries(TENANT_BRANDING)) {
    if (branding.slug.toLowerCase() === clean) return tenantId;
    if (tenantId.toLowerCase() === clean) return tenantId;
  }
  return null;
}

export function getTenantCodePrefix(tenantId: string): string {
  return getTenantBranding(tenantId).codePrefix;
}
