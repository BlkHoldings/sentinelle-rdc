/**
 * Airtel Money DRC Integration
 * API Documentation: https://openapi.airtel.africa
 * Supports Collections API for merchant payments in DRC
 */

import {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  PaymentStatusResponse,
  ProviderConfig,
} from './types';

interface AirtelTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: string;
}

interface AirtelPaymentResponse {
  status: {
    code: string;
    message: string;
    result_code: string;
    response_code: string;
    success: boolean;
  };
  data?: {
    transaction: {
      id: string;
      status: string;
      airtel_money_id?: string;
    };
  };
}

interface AirtelStatusResponse {
  status: {
    code: string;
    message: string;
    result_code: string;
    success: boolean;
  };
  data?: {
    transaction: {
      id: string;
      status: string;
      message: string;
      airtel_money_id?: string;
    };
  };
}

export class AirtelMoneyService {
  private config: ProviderConfig;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.config = {
      clientId: process.env.AIRTEL_MONEY_CLIENT_ID,
      clientSecret: process.env.AIRTEL_MONEY_CLIENT_SECRET,
      baseUrl:
        process.env.AIRTEL_MONEY_BASE_URL || 'https://openapi.airtel.africa',
      environment:
        (process.env.AIRTEL_MONEY_ENVIRONMENT as 'sandbox' | 'production') ||
        'sandbox',
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiry) {
      return this.cachedToken;
    }

    const response = await fetch(`${this.config.baseUrl}/auth/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Airtel Money auth failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as AirtelTokenResponse;
    this.cachedToken = data.access_token;
    const expiresIn = parseInt(data.expires_in, 10) || 3600;
    this.tokenExpiry = now + expiresIn * 1000 - 60_000;
    return this.cachedToken;
  }

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[\s\-\+]/g, '');
    // Airtel Africa expects MSISDN without country code prefix for some endpoints
    if (cleaned.startsWith('243')) return cleaned.slice(3);
    if (cleaned.startsWith('0')) return cleaned.slice(1);
    return cleaned;
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
    const transactionId = `AM_${Date.now()}_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    try {
      const accessToken = await this.getAccessToken();

      const payload = {
        reference: request.reference,
        subscriber: {
          country: 'CD', // DRC country code
          currency: request.currency || 'CDF',
          msisdn: formattedPhone,
        },
        transaction: {
          amount: Math.round(request.amount),
          country: 'CD',
          currency: request.currency || 'CDF',
          id: transactionId,
        },
      };

      const response = await fetch(
        `${this.config.baseUrl}/merchant/v1/payments/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Country': 'CD',
            'X-Currency': request.currency || 'CDF',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorBody = (await response.json()) as {
          status?: { message?: string; code?: string };
        };
        return {
          success: false,
          transactionId,
          provider: PaymentProvider.AIRTEL_MONEY,
          status: PaymentStatus.FAILED,
          message:
            errorBody.status?.message || 'Échec du paiement Airtel Money',
          errorCode: errorBody.status?.code,
          timestamp: new Date().toISOString(),
        };
      }

      const data = (await response.json()) as AirtelPaymentResponse;

      if (data.status.success) {
        return {
          success: true,
          transactionId: data.data?.transaction.id || transactionId,
          provider: PaymentProvider.AIRTEL_MONEY,
          status: PaymentStatus.PENDING,
          message:
            'Demande de paiement envoyée. Vérifiez votre téléphone Airtel pour confirmer.',
          checkoutRequestId: data.data?.transaction.airtel_money_id,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        transactionId,
        provider: PaymentProvider.AIRTEL_MONEY,
        status: PaymentStatus.FAILED,
        message: data.status.message || 'Erreur Airtel Money',
        errorCode: data.status.result_code,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Erreur réseau inconnue';
      return {
        success: false,
        transactionId,
        provider: PaymentProvider.AIRTEL_MONEY,
        status: PaymentStatus.FAILED,
        message: `Erreur Airtel Money: ${errMessage}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async checkStatus(transactionId: string): Promise<PaymentStatusResponse> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.config.baseUrl}/standard/v1/payments/${transactionId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'X-Country': 'CD',
            'X-Currency': 'CDF',
          },
        }
      );

      if (!response.ok) {
        return {
          transactionId,
          status: PaymentStatus.FAILED,
          provider: PaymentProvider.AIRTEL_MONEY,
          errorMessage: `HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as AirtelStatusResponse;

      const statusMap: Record<string, PaymentStatus> = {
        TS: PaymentStatus.COMPLETED,
        TF: PaymentStatus.FAILED,
        TP: PaymentStatus.PENDING,
        TC: PaymentStatus.CANCELLED,
        TI: PaymentStatus.PROCESSING,
      };

      const txStatus = data.data?.transaction.status || '';

      return {
        transactionId,
        status: statusMap[txStatus] || PaymentStatus.PENDING,
        provider: PaymentProvider.AIRTEL_MONEY,
        errorMessage: !data.status.success
          ? data.data?.transaction.message
          : undefined,
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        transactionId,
        status: PaymentStatus.FAILED,
        provider: PaymentProvider.AIRTEL_MONEY,
        errorMessage: errMessage,
      };
    }
  }
}
