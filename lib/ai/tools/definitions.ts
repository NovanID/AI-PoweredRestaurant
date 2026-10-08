import type { LLMToolDefinition, ToolName } from '../types.ts';

export const PROTECTED_TOOL_NAMES: ToolName[] = [
  'create_reservation',
  'update_reservation',
  'cancel_reservation',
];

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = []
): Record<string, unknown> => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

export const RESTAURANT_TOOL_DEFINITIONS: LLMToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_restaurant_info',
      description: 'Ambil profil, alamat, kontak, jam operasional, dan kebijakan restoran Raso Minang.',
      parameters: objectSchema({}),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_menu',
      description: 'Ambil daftar menu aktif berdasarkan kategori atau kata kunci opsional.',
      parameters: objectSchema({
        category: { type: 'string', enum: ['Semua', 'Lauk Utama', 'Sayur & Kuah', 'Pelengkap & Sambal', 'Minuman'] },
        search: { type: 'string' },
      }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_menu',
      description: 'Cari menu restoran berdasarkan kata kunci seperti nama hidangan atau deskripsi.',
      parameters: objectSchema({ search: { type: 'string' } }, ['search']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Cek ketersediaan meja berdasarkan tanggal, waktu, jumlah tamu, dan area opsional.',
      parameters: objectSchema(
        {
          date: { type: 'string', description: 'Tanggal YYYY-MM-DD' },
          time: { type: 'string', description: 'Waktu HH:mm' },
          guestCount: { type: 'number' },
          preferredArea: { type: 'string', enum: ['Indoor', 'Outdoor', 'VIP'] },
        },
        ['date', 'time', 'guestCount']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_reservation',
      description: 'Buat reservasi baru setelah user memberi konfirmasi eksplisit.',
      parameters: objectSchema(
        {
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          date: { type: 'string', description: 'Tanggal YYYY-MM-DD' },
          time: { type: 'string', description: 'Waktu HH:mm' },
          guestCount: { type: 'number' },
          notes: { type: 'string' },
          preferredArea: { type: 'string', enum: ['Indoor', 'Outdoor', 'VIP'] },
        },
        ['customerName', 'customerPhone', 'date', 'time', 'guestCount']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reservation',
      description: 'Ambil detail reservasi berdasarkan kode reservasi seperti RM-ABCD.',
      parameters: objectSchema({ code: { type: 'string' } }, ['code']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_reservation',
      description: 'Ubah jadwal, jumlah tamu, area, atau catatan reservasi setelah konfirmasi user.',
      parameters: objectSchema(
        {
          code: { type: 'string' },
          newDate: { type: 'string', description: 'Tanggal baru YYYY-MM-DD' },
          newTime: { type: 'string', description: 'Waktu baru HH:mm' },
          newGuestCount: { type: 'number' },
          preferredArea: { type: 'string', enum: ['Indoor', 'Outdoor', 'VIP'] },
          notes: { type: 'string' },
        },
        ['code']
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_reservation',
      description: 'Batalkan reservasi berdasarkan kode setelah konfirmasi user.',
      parameters: objectSchema({ code: { type: 'string' }, reason: { type: 'string' } }, ['code']),
    },
  },
];
