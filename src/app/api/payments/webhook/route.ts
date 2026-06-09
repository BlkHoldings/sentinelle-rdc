import { NextRequest, NextResponse } from 'next/server';
import { PaymentProvider, PaymentStatus, WebhookPayload } from '@/lib/mobile-money';

/**
 * Unified webhook handler for all mobile money providers.
 * Each provider sends slightly different payloads; we normalise to WebhookPayload.
 *
 * Providers should be configured to POST to:
 *   https://your-domain.com/api/payments/webhook
 *
 * The `X-Provider` header identifies the source (MPESA | ORANGE_MONEY | AIRTEL_MONEY).
 */

function normalizeMpesaPayload(raw: Record<string, unknown>): WebhookPayload | null {
  const body = raw.Body as Record<string, unknown> | undefined;
  if (!body) return null;

  const callback = body.stkCallback as Record<string, unknown> | undefined;
  if (!callback) return null;

  const resultCode = callback.ResultCode as string;
  const callbackMetadata = callback.CallbackMetadata as Record<string, unknown> | undefined;
  const items = (callbackMetadata?.Item as Array<Record<string, unknown>>) || [];

  function getItem(name: string): string | number | undefined {
    const item = items.find((i) => i.Name === name);
    return item?.Value as string | number | undefined;
  }

  return {
    transactionId: (callback.CheckoutRequestID as string) || '',
    provider: PaymentProvider.MPESA,
    status: resultCode === '0' ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
    amount: Number(getItem('Amount') || 0),
    currency: 'CDF',
    phoneNumber: String(getItem('PhoneNumber') || ''),
    reference: String(getItem('AccountReference') || ''),
    timestamp: new Date().toISOString(),
    rawPayload: raw,
  };
}

function normalizeOrangePayload(raw: Record<string, unknown>): WebhookPayload | null {
  const data = raw.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const statusMap: Record<string, PaymentStatus> = {
    SUCCESS: PaymentStatus.COMPLETED,
    FAILED: PaymentStatus.FAILED,
    PENDING: PaymentStatus.PENDING,
    CANCELLED: PaymentStatus.CANCELLED,
  };

  return {
    transactionId: (data.txnid as string) || (data.payToken as string) || '',
    provider: PaymentProvider.ORANGE_MONEY,
    status: statusMap[data.status as string] || PaymentStatus.PENDING,
    amount: Number(data.amount || 0),
    currency: (data.currency as string) || 'CDF',
    phoneNumber: (data.subscriberMsisdn as string) || '',
    reference: (data.orderId as string) || '',
    timestamp: new Date().toISOString(),
    rawPayload: raw,
  };
}

function normalizeAirtelPayload(raw: Record<string, unknown>): WebhookPayload | null {
  const transaction = raw.transaction as Record<string, unknown> | undefined;
  if (!transaction) return null;

  const statusMap: Record<string, PaymentStatus> = {
    TS: PaymentStatus.COMPLETED,
    TF: PaymentStatus.FAILED,
    TP: PaymentStatus.PENDING,
    TC: PaymentStatus.CANCELLED,
  };

  return {
    transactionId: (transaction.id as string) || '',
    provider: PaymentProvider.AIRTEL_MONEY,
    status: statusMap[transaction.status as string] || PaymentStatus.PENDING,
    amount: Number(transaction.amount || 0),
    currency: (transaction.currency as string) || 'CDF',
    phoneNumber: (transaction.msisdn as string) || '',
    reference: (transaction.reference as string) || '',
    timestamp: new Date().toISOString(),
    rawPayload: raw,
  };
}

async function processWebhook(payload: WebhookPayload): Promise<void> {
  // In production: update your database order status, send notifications, etc.
  console.log('[webhook] Payment update:', {
    transactionId: payload.transactionId,
    provider: payload.provider,
    status: payload.status,
    amount: payload.amount,
    currency: payload.currency,
    reference: payload.reference,
    timestamp: payload.timestamp,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: Record<string, unknown>;

  try {
    rawBody = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Corps de la requête invalide.' },
      { status: 400 }
    );
  }

  // Determine provider from header or body heuristics
  const providerHeader = request.headers.get('X-Provider') ||
    request.headers.get('x-provider') || '';

  let normalized: WebhookPayload | null = null;

  if (providerHeader.toUpperCase() === 'MPESA' || rawBody.Body) {
    normalized = normalizeMpesaPayload(rawBody);
  } else if (providerHeader.toUpperCase() === 'ORANGE_MONEY' || rawBody.data) {
    normalized = normalizeOrangePayload(rawBody);
  } else if (providerHeader.toUpperCase() === 'AIRTEL_MONEY' || rawBody.transaction) {
    normalized = normalizeAirtelPayload(rawBody);
  }

  if (!normalized) {
    console.warn('[webhook] Unrecognised payload structure:', rawBody);
    // Return 200 to avoid retries from the provider on unrecognised formats
    return NextResponse.json({ received: true, status: 'unrecognised' }, { status: 200 });
  }

  try {
    await processWebhook(normalized);
    return NextResponse.json({ received: true, transactionId: normalized.transactionId }, { status: 200 });
  } catch (error) {
    console.error('[webhook] Processing error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement du webhook.' },
      { status: 500 }
    );
  }
}

// Allow HEAD requests (some providers probe the endpoint)
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 });
}
