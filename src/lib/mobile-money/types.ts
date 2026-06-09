export enum PaymentProvider {
  MPESA = 'MPESA',
  ORANGE_MONEY = 'ORANGE_MONEY',
  AIRTEL_MONEY = 'AIRTEL_MONEY',
}

export interface PaymentRequest {
  provider: PaymentProvider;
  phoneNumber: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
  callbackUrl?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  message: string;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
}

export interface PaymentStatusResponse {
  transactionId: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  amount?: number;
  currency?: string;
  phoneNumber?: string;
  reference?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface WebhookPayload {
  transactionId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  phoneNumber: string;
  reference: string;
  timestamp: string;
  rawPayload?: Record<string, unknown>;
}

export interface ProviderConfig {
  apiKey?: string;
  apiSecret?: string;
  clientId?: string;
  clientSecret?: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
  shortCode?: string;
  passKey?: string;
}
