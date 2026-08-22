import crypto from 'crypto';

export interface MidtransConfig {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
  snapUrl: string;
  apiUrl: string;
}

export interface MidtransCustomerDetails {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface MidtransItemDetail {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

export interface CreateSnapTransactionParams {
  orderId: string;
  grossAmount: number;
  customerDetails?: MidtransCustomerDetails;
  itemDetails?: MidtransItemDetail[];
  notes?: string;
}

export interface SnapTransactionResponse {
  token: string;
  redirect_url: string;
}

/**
 * Retrieve Midtrans configuration from environment variables
 */
export function getMidtransConfig(): MidtransConfig {
  const serverKey = (
    process.env.MIDTRANS_SERVER_KEY || ''
  ).trim();
  const clientKey = (
    process.env.MIDTRANS_CLIENT_KEY ||
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
    ''
  ).trim();

  // If explicit env set, respect it; otherwise check key prefix
  const isExplicitProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  const isExplicitSandbox = process.env.MIDTRANS_IS_PRODUCTION === 'false';
  const isProduction = isExplicitSandbox
    ? false
    : isExplicitProd || (serverKey.startsWith('Mid-server-') && !serverKey.startsWith('SB-'));

  const snapUrl = isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  const apiUrl = isProduction
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com';

  return {
    serverKey,
    clientKey,
    isProduction,
    snapUrl,
    apiUrl,
  };
}

/**
 * Create a Snap Transaction and get snap_token & redirect_url
 */
export async function createSnapTransaction(
  params: CreateSnapTransactionParams
): Promise<SnapTransactionResponse> {
  const config = getMidtransConfig();
  const endpoint = config.isProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

  const authString = Buffer.from(`${config.serverKey}:`).toString('base64');

  const payload = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: Math.round(params.grossAmount),
    },
    customer_details: params.customerDetails
      ? {
          first_name: params.customerDetails.firstName,
          last_name: params.customerDetails.lastName,
          email: params.customerDetails.email || 'customer@rasominang.com',
          phone: params.customerDetails.phone,
        }
      : undefined,
    item_details: params.itemDetails && params.itemDetails.length > 0
      ? params.itemDetails.map((item) => ({
          id: item.id,
          price: Math.round(item.price),
          quantity: item.quantity,
          name: item.name.slice(0, 50),
        }))
      : [
          {
            id: `DEPOSIT-${params.orderId}`,
            price: Math.round(params.grossAmount),
            quantity: 1,
            name: `Deposit Reservasi (${params.orderId})`,
          },
        ],
    credit_card: {
      secure: true,
    },
    enabled_payments: [
      'credit_card',
      'gopay',
      'shopeepay',
      'qris',
      'bca_va',
      'bni_va',
      'bri_va',
      'mandiri_va',
      'permata_va',
      'other_va',
      'indomaret',
      'alfamart',
      'akulaku',
    ],
    usage_limit: 5,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Midtrans Snap Error:', data);
      throw new Error(
        data.error_messages
          ? data.error_messages.join(', ')
          : `Gagal membuat transaksi Midtrans (HTTP ${response.status})`
      );
    }

    return {
      token: data.token,
      redirect_url: data.redirect_url,
    };
  } catch (error: any) {
    console.error('Failed to create Midtrans Snap transaction:', error);
    throw error;
  }
}

/**
 * Verify SHA512 signature from Midtrans Webhook Notification
 * SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const config = getMidtransConfig();
  const rawString = `${params.orderId}${params.statusCode}${params.grossAmount}${config.serverKey}`;
  const calculatedSignature = crypto
    .createHash('sha512')
    .update(rawString)
    .digest('hex');

  return calculatedSignature.toLowerCase() === params.signatureKey.toLowerCase();
}

/**
 * Map Midtrans Transaction Status to Application Domain Status
 */
export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string
): {
  paymentStatus: 'unpaid' | 'pending' | 'settlement' | 'expire' | 'cancel';
  reservationStatus: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  description: string;
} {
  switch (transactionStatus) {
    case 'capture':
      if (fraudStatus === 'challenge') {
        return {
          paymentStatus: 'pending',
          reservationStatus: 'pending',
          description: 'Pembayaran tertahan oleh Fraud Detection System (Challenge)',
        };
      }
      return {
        paymentStatus: 'settlement',
        reservationStatus: 'confirmed',
        description: 'Pembayaran kartu kredit sukses dan terkonfirmasi (Capture Accept)',
      };

    case 'settlement':
      return {
        paymentStatus: 'settlement',
        reservationStatus: 'confirmed',
        description: 'Pembayaran berhasil (Settlement) - Reservasi Otomatis Dikonfirmasi',
      };

    case 'pending':
      return {
        paymentStatus: 'pending',
        reservationStatus: 'pending',
        description: 'Menunggu pembayaran dari pelanggan (Pending)',
      };

    case 'deny':
      return {
        paymentStatus: 'cancel',
        reservationStatus: 'rejected',
        description: 'Pembayaran ditolak oleh penyedia pembayaran (Deny)',
      };

    case 'cancel':
      return {
        paymentStatus: 'cancel',
        reservationStatus: 'cancelled',
        description: 'Pembayaran dibatalkan oleh pengguna atau merchant (Cancel)',
      };

    case 'expire':
      return {
        paymentStatus: 'expire',
        reservationStatus: 'cancelled',
        description: 'Waktu pembayaran telah habis / kadaluarsa (Expire)',
      };

    case 'refund':
    case 'partial_refund':
      return {
        paymentStatus: 'cancel',
        reservationStatus: 'cancelled',
        description: 'Dana pembayaran telah dikembalikan (Refund)',
      };

    default:
      return {
        paymentStatus: 'pending',
        reservationStatus: 'pending',
        description: `Status transaksi: ${transactionStatus}`,
      };
  }
}

/**
 * Check transaction status from Midtrans API
 */
export async function getMidtransTransactionStatus(orderId: string): Promise<any> {
  const config = getMidtransConfig();
  const endpoint = `${config.apiUrl}/v2/${orderId}/status`;
  const authString = Buffer.from(`${config.serverKey}:`).toString('base64');

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${authString}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch status for order ${orderId} (HTTP ${response.status})`);
  }

  return response.json();
}
