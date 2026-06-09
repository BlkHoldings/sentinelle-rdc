/**
 * Unified Mobile Money Service for DRC market
 * Supports M-Pesa (Vodacom), Orange Money, and Airtel Money
 */

export { MPesaService } from './mpesa';
export { OrangeMoneyService } from './orange-money';
export { AirtelMoneyService } from './airtel-money';
export * from './types';

import { MPesaService } from './mpesa';
import { OrangeMoneyService } from './orange-money';
import { AirtelMoneyService } from './airtel-money';
import {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  PaymentStatusResponse,
} from './types';

export class MobileMoneyService {
  private mpesa: MPesaService;
  private orangeMoney: OrangeMoneyService;
  private airtelMoney: AirtelMoneyService;

  constructor() {
    this.mpesa = new MPesaService();
    this.orangeMoney = new OrangeMoneyService();
    this.airtelMoney = new AirtelMoneyService();
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    switch (request.provider) {
      case PaymentProvider.MPESA:
        return this.mpesa.initiatePayment(request);
      case PaymentProvider.ORANGE_MONEY:
        return this.orangeMoney.initiatePayment(request);
      case PaymentProvider.AIRTEL_MONEY:
        return this.airtelMoney.initiatePayment(request);
      default:
        throw new Error(`Fournisseur de paiement non supporté: ${request.provider}`);
    }
  }

  async checkPaymentStatus(
    provider: PaymentProvider,
    transactionId: string
  ): Promise<PaymentStatusResponse> {
    switch (provider) {
      case PaymentProvider.MPESA:
        return this.mpesa.checkStatus(transactionId);
      case PaymentProvider.ORANGE_MONEY:
        return this.orangeMoney.checkStatus(transactionId);
      case PaymentProvider.AIRTEL_MONEY:
        return this.airtelMoney.checkStatus(transactionId);
      default:
        throw new Error(`Fournisseur de paiement non supporté: ${provider}`);
    }
  }

  static getProviderLabel(provider: PaymentProvider): string {
    const labels: Record<PaymentProvider, string> = {
      [PaymentProvider.MPESA]: 'M-Pesa (Vodacom)',
      [PaymentProvider.ORANGE_MONEY]: 'Orange Money',
      [PaymentProvider.AIRTEL_MONEY]: 'Airtel Money',
    };
    return labels[provider];
  }

  static getProviderColor(provider: PaymentProvider): string {
    const colors: Record<PaymentProvider, string> = {
      [PaymentProvider.MPESA]: '#E11D48',
      [PaymentProvider.ORANGE_MONEY]: '#F97316',
      [PaymentProvider.AIRTEL_MONEY]: '#DC2626',
    };
    return colors[provider];
  }

  static validateDRCPhoneNumber(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-\+]/g, '');
    // DRC mobile numbers: 0XXXXXXXXX (10 digits) or 243XXXXXXXXX (12 digits) or 9 digits
    return (
      /^(243)?\d{9}$/.test(cleaned) ||
      /^0\d{9}$/.test(cleaned)
    );
  }
}
