/**
 * M-Pesa Vodacom DRC Integration
 * API Documentation: https://openapi.m-pesa.com
 * Supports STK Push (Lipa Na M-Pesa) for DRC market
 */

import {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  PaymentStatusResponse,
  ProviderConfig,
} from './types';

export class MPesaService {
  private config: ProviderConfig;

  constructor() {
    this.config = {
      apiKey: process.env.MPESA_API_KEY,
      apiSecret: process.env.MPESA_API_SECRET,
      baseUrl:
        process.env.MPESA_BASE_URL || 'https://openapi.m-pesa.com',
      environment:
        (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') ||
        'sandbox',
      shortCode: process.env.MPESA_SHORT_CODE,
      passKey: process.env.MPESA_PASS_KEY,
    };
  }

  private async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(
      `${this.config.apiKey}:${this.config.apiSecret}`
    ).toString('base64');

    const response = await fetch(
      `${this.config.baseUrl}/v1/usercontroller/authorize`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `M-Pesa auth failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  private generatePassword(timestamp: string): string {
    const raw = `${this.config.shortCode}${this.config.passKey}${timestamp}`;
    return Buffer.from(raw).toString('base64');
  }

  private formatPhoneNumber(phone: string): string {
    // Normalize DRC phone numbers to 243XXXXXXXXX format
    const cleaned = phone.replace(/[\s\-\+]/g, '');
    if (cleaned.startsWith('243')) return cleaned;
    if (cleaned.startsWith('0')) return `243${cleaned.slice(1)}`;
    if (cleaned.length === 9) return `243${cleaned}`;
    return cleaned;
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const password = this.generatePassword(timestamp);
    const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
    const transactionId = `MPESA_${Date.now()}_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    try {
      const accessToken = await this.getAccessToken();

      const payload = {
        BusinessShortCode: this.config.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(request.amount),
        PartyA: formattedPhone,
        PartyB: this.config.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL:
          request.callbackUrl ||
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/webhook`,
        AccountReference: request.reference,
        TransactionDesc: request.description,
      };

      const response = await fetch(
        `${this.config.baseUrl}/v1/processrequest/process`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorBody = (await response.json()) as {
          errorCode?: string;
          errorMessage?: string;
        };
        return {
          success: false,
          transactionId,
          provider: PaymentProvider.MPESA,
          status: PaymentStatus.FAILED,
          message: errorBody.errorMessage || 'Payment initiation failed',
          errorCode: errorBody.errorCode,
          errorMessage: errorBody.errorMessage,
          timestamp: new Date().toISOString(),
        };
      }

      const data = (await response.json()) as {
        ResponseCode: string;
        ResponseDescription: string;
        CheckoutRequestID?: string;
        MerchantRequestID?: string;
      };

      if (data.ResponseCode === '0') {
        return {
          success: true,
          transactionId,
          provider: PaymentProvider.MPESA,
          status: PaymentStatus.PENDING,
          message:
            'STK Push envoyé. Veuillez vérifier votre téléphone pour confirmer le paiement.',
          checkoutRequestId: data.CheckoutRequestID,
          merchantRequestId: data.MerchantRequestID,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        transactionId,
        provider: PaymentProvider.MPESA,
        status: PaymentStatus.FAILED,
        message: data.ResponseDescription || 'Échec de l\'initiation du paiement',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Erreur réseau inconnue';
      return {
        success: false,
        transactionId,
        provider: PaymentProvider.MPESA,
        status: PaymentStatus.FAILED,
        message: `Erreur M-Pesa: ${errMessage}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async checkStatus(
    checkoutRequestId: string
  ): Promise<PaymentStatusResponse> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const password = this.generatePassword(timestamp);

    try {
      const accessToken = await this.getAccessToken();

      const payload = {
        BusinessShortCode: this.config.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };

      const response = await fetch(
        `${this.config.baseUrl}/v1/querytransaction/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        return {
          transactionId: checkoutRequestId,
          status: PaymentStatus.FAILED,
          provider: PaymentProvider.MPESA,
          errorMessage: `HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        ResultCode: string;
        ResultDesc: string;
      };

      const statusMap: Record<string, PaymentStatus> = {
        '0': PaymentStatus.COMPLETED,
        '1032': PaymentStatus.CANCELLED,
        '1037': PaymentStatus.TIMEOUT,
      };

      return {
        transactionId: checkoutRequestId,
        status: statusMap[data.ResultCode] || PaymentStatus.PENDING,
        provider: PaymentProvider.MPESA,
        errorCode: data.ResultCode !== '0' ? data.ResultCode : undefined,
        errorMessage:
          data.ResultCode !== '0' ? data.ResultDesc : undefined,
      };
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        transactionId: checkoutRequestId,
        status: PaymentStatus.FAILED,
        provider: PaymentProvider.MPESA,
        errorMessage: errMessage,
      };
    }
  }
}
