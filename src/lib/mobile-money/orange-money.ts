/**
 * Orange Money DRC Integration
 * API Documentation: https://api.orange.com/orange-money-webpay/dev/v1
 * Supports Web Payment (redirect-based) and Push USSD for DRC
 */

import {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  PaymentStatusResponse,
  ProviderConfig,
} from './types';

interface OrangeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface OrangePaymentInitResponse {
  status: string;
  message: string;
  data?: {
    payToken: string;
    notifToken: string;
  };
}

interface OrangePaymentStatusResponse {
  status: string;
  message: string;
  data?: {
    status: string;
    txnid: string;
    amount: string;
    currency: string;
    subscriberMsisdn: string;
    payToken: string;
  };
}

export class OrangeMoneyService {
  private config: ProviderConfig;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      clientId: process.env.ORANGE_MONEY_CLIENT_ID,
      clientSecret: process.env.ORANGE_MONEY_CLIENT_SECRET,
      baseUrl:
        process.env.ORANGE_MONEY_BASE_URL ||
        'https://api.orange.com/orange-money-webpay/dev/v1',
      environment:
        (process.env.ORANGE_MONEY_ENVIRONMENT as 'sandbox' | 'production') ||
        'sandbox',
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiry) {
      return this.cachedToken;
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    const response = await fetch(
      'https://api.orange.com/oauth/v3/token',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
      }
    );

    if (!response.ok) {
      throw new Error(
        `Orange Money auth failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as OrangeTokenResponse;
    this.cachedToken = data.access_token;
    this.tokenExpiry = now + data.expires_in * 1000 - 60_000;
    return this.cachedToken;
  }

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-\+]/g, '');
    if (cleaned.startsWith('243')) return cleaned;
    if (cleaned.startsWith('0')) return `243${cleaned.slice(1)}`;
    if (cleaned.length === 9) return `243${cleaned}`;
    return cleaned;
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
    const transactionId = `OM_${Date.now()}_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    try {
      const accessToken = await this.getAccessToken();

      const payload = {
        merchant_key: this.config.clientId,
        currency: request.currency || 'CDF',
        order_id: request.reference,
        amount: Math.round(request.amount).toString(),
        return_url:
          request.callbackUrl ||
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/webhook`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/store`,
        notif_url:
          request.callbackUrl ||
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/webhook`,
        lang: 'fr',
        reference: request.reference,
      };

      const response = await fetch(`${this.config.baseUrl}/webpayment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = (await response.json()) as {
          message?: string;
          error?: string;
        };
        return {
          success: false,
          transactionId,
          provider: PaymentProvider.ORANGE_MONEY,
          status: PaymentStatus.FAILED,
          message: errorBody.message || errorBody.error || 'Échec du paiement Orange Money',
          timestamp: new Date().toISOString(),
        };
      }

      const data = (await response.json()) as OrangePaymentInitResponse;

      if (data.status === 'SUCCESS' && data.data) {
        // Trigger USSD push to customer phone
        await this.triggerUssdPush(
          accessToken,
          formattedPhone,
          data.data.payToken
        );

        return {
          success: true,
          transactionId,
          provider: PaymentProvider.ORANGE_MONEY,
          status: PaymentStatus.PENDING,
          message:
            'Demande envoyée. Veuillez confirmer le paiement sur votre téléphone Orange.',
          checkoutRequestId: data.data.payToken,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        transactionId,
        provider: PaymentProvider.ORANGE_MONEY,
        status: PaymentStatus.FAILED,
        message: data.message || 'Erreur lors de l\'initiation Orange Money',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Erreur réseau inconnue';
      return {
        success: false,
        transactionId,
        provider: PaymentProvider.ORANGE_MONEY,
        status: PaymentStatus.FAILED,
        message: `Erreur Orange Money: ${errMessage}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async triggerUssdPush(
    accessToken: string,
    phoneNumber: string,
    payToken: string
  ): Promise<void> {
    try {
      await fetch(`${this.config.baseUrl}/cash-in`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_msisdn: phoneNumber,
          pay_token: payToken,
          pin: process.env.ORANGE_MONEY_PIN || '',
        }),
      });
    } catch {
      // USSD push failure is non-fatal; customer can still confirm via USSD manually
    }
  }

  async checkStatus(payToken: string): Promise<PaymentStatusResponse> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.config.baseUrl}/paymentstatus/${payToken}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        return {
          transactionId: payToken,
          status: PaymentStatus.FAILED,
          provider: PaymentProvider.ORANGE_MONEY,
          errorMessage: `HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as OrangePaymentStatusResponse;

      const statusMap: Record<string, PaymentStatus> = {
        SUCCESS: PaymentStatus.COMPLETED,
        FAILED: PaymentStatus.FAILED,
        PENDING: PaymentStatus.PENDING,
        CANCELLED: PaymentStatus.CANCELLED,
        EXPIRED: PaymentStatus.TIMEOUT,
      };

      return {
        transactionId: payToken,
        status: statusMap[data.data?.status || ''] || PaymentStatus.PENDING,
        provider: PaymentProvider.ORANGE_MONEY,
        amount: data.data?.amount ? parseFloat(data.data.amount) : undefined,
        currency: data.data?.currency,
        phoneNumber: data.data?.subscriberMsisdn,
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        transactionId: payToken,
        status: PaymentStatus.FAILED,
        provider: PaymentProvider.ORANGE_MONEY,
        errorMessage: errMessage,
      };
    }
  }
}
