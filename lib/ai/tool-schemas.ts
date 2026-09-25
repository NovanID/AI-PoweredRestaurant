import { z } from 'zod';

/**
 * Zod Schemas for all AI Restaurant Tools
 * Providing strict runtime validation, coercion, and type-safety.
 */

export const GetRestaurantInfoSchema = z.object({}).catchall(z.any());

export const GetMenuSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  maxPrice: z.coerce.number().positive('Harga maksimal harus lebih dari 0').optional(),
  spicinessLevel: z.coerce.number().int().min(1).max(3, 'Level pedas antara 1 sampai 3').optional(),
});

export const CheckAvailabilitySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD (contoh: 2026-09-15)'),
  time: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format jam harus HH:mm (contoh: 19:00)'),
  guestCount: z.coerce.number().int().min(1, 'Jumlah tamu minimal 1 orang'),
  preferredArea: z.enum(['Indoor', 'Outdoor', 'VIP']).optional().or(z.string().optional()),
});

export const RequestReservationHoldSchema = z.object({
  customerName: z.string().min(1, 'Nama pemesan wajib diisi'),
  customerPhone: z.string().optional().default('-'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  time: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format jam harus HH:mm'),
  guestCount: z.coerce.number().int().min(1, 'Jumlah tamu minimal 1 orang'),
  preferredArea: z.string().optional(),
  notes: z.string().optional(),
});

export const ConfirmReservationSchema = z.object({
  leaseToken: z.string().min(1, 'leaseToken wajib disertakan'),
  idempotencyKey: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
});

export const GetReservationSchema = z.object({
  code: z
    .string()
    .min(1, 'Kode reservasi wajib diisi')
    .transform((val) => val.trim().toUpperCase()),
});

export const CancelReservationSchema = z.object({
  code: z
    .string()
    .min(1, 'Kode reservasi wajib diisi')
    .transform((val) => val.trim().toUpperCase()),
  reason: z.string().optional().default('Dibatalkan oleh pelanggan via chat'),
});

export const UpdateReservationSchema = z.object({
  code: z
    .string()
    .min(1, 'Kode reservasi wajib diisi')
    .transform((val) => val.trim().toUpperCase()),
  newDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal baru harus YYYY-MM-DD')
    .optional(),
  newTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format jam baru harus HH:mm')
    .optional(),
  newGuestCount: z.coerce.number().int().min(1, 'Jumlah tamu minimal 1 orang').optional(),
});

export const OrderItemSchema = z.object({
  menuName: z.string().optional(),
  name: z.string().optional(),
  menuItemId: z.string().optional(),
  quantity: z.coerce.number().int().min(1, 'Jumlah porsi minimal 1').default(1),
  notes: z.string().optional(),
});

export const CalculateOrderTotalSchema = z.object({
  items: z.array(OrderItemSchema).min(1, 'Daftar item pesanan tidak boleh kosong'),
});

export const CreateTakeawayOrderSchema = z.object({
  customerName: z.string().optional().default('Pelanggan Takeaway'),
  customerPhone: z.string().optional().default('-'),
  items: z.array(OrderItemSchema).min(1, 'Item pesanan tidak boleh kosong'),
  notes: z.string().optional(),
});

export const ContactHumanSchema = z.object({
  reason: z.string().min(1, 'Alasan eskalasi wajib diisi'),
});

// Registry map of all tool schemas
export const TOOL_SCHEMAS: Record<string, z.ZodType<any>> = {
  get_restaurant_info: GetRestaurantInfoSchema,
  get_menu: GetMenuSchema,
  check_availability: CheckAvailabilitySchema,
  request_reservation_hold: RequestReservationHoldSchema,
  confirm_reservation: ConfirmReservationSchema,
  get_reservation: GetReservationSchema,
  cancel_reservation: CancelReservationSchema,
  update_reservation: UpdateReservationSchema,
  calculate_order_total: CalculateOrderTotalSchema,
  create_takeaway_order: CreateTakeawayOrderSchema,
  contact_human: ContactHumanSchema,
};

// Inferred TypeScript Types
export type GetRestaurantInfoArgs = z.infer<typeof GetRestaurantInfoSchema>;
export type GetMenuArgs = z.infer<typeof GetMenuSchema>;
export type CheckAvailabilityArgs = z.infer<typeof CheckAvailabilitySchema>;
export type RequestReservationHoldArgs = z.infer<typeof RequestReservationHoldSchema>;
export type ConfirmReservationArgs = z.infer<typeof ConfirmReservationSchema>;
export type GetReservationArgs = z.infer<typeof GetReservationSchema>;
export type CancelReservationArgs = z.infer<typeof CancelReservationSchema>;
export type UpdateReservationArgs = z.infer<typeof UpdateReservationSchema>;
export type CalculateOrderTotalArgs = z.infer<typeof CalculateOrderTotalSchema>;
export type CreateTakeawayOrderArgs = z.infer<typeof CreateTakeawayOrderSchema>;
export type ContactHumanArgs = z.infer<typeof ContactHumanSchema>;

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate and coerce raw tool arguments against registered Zod schemas
 */
export function validateToolArgs<T = any>(
  toolName: string,
  rawArgs: Record<string, any>
): ValidationResult<T> {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    return {
      success: false,
      errors: [`Tool "${toolName}" tidak memiliki skema validasi terdaftar.`],
    };
  }

  const result = schema.safeParse(rawArgs || {});
  if (!result.success) {
    const formattedErrors = result.error.issues.map((issue) => {
      const pathStr = issue.path.length > 0 ? `[${issue.path.join('.')}] ` : '';
      return `${pathStr}${issue.message}`;
    });
    return {
      success: false,
      errors: formattedErrors,
    };
  }

  return {
    success: true,
    data: result.data as T,
  };
}
