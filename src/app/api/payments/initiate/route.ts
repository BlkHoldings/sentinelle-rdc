import { NextRequest, NextResponse } from 'next/server';
import { MobileMoneyService, PaymentProvider, PaymentRequest } from '@/lib/mobile-money';

interface InitiateBody {
  provider: string;
  phoneNumber: string;
  amount: number;
  currency?: string;
  reference: string;
  description?: string;
  callbackUrl?: string;
}

function validateProvider(provider: string): provider is PaymentProvider {
  return Object.values(PaymentProvider).includes(provider as PaymentProvider);
}

function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\+]/g, '');
  return /^(243)?\d{9}$/.test(cleaned) || /^0\d{9}$/.test(cleaned);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: InitiateBody;

  try {
    body = (await request.json()) as InitiateBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Corps de la requête invalide (JSON attendu).' },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.provider || !body.phoneNumber || !body.amount || !body.reference) {
    return NextResponse.json(
      {
        success: false,
        error: 'Champs requis manquants: provider, phoneNumber, amount, reference.',
      },
      { status: 400 }
    );
  }

  if (!validateProvider(body.provider)) {
    return NextResponse.json(
      {
        success: false,
        error: `Fournisseur invalide: ${body.provider}. Valeurs acceptées: ${Object.values(PaymentProvider).join(', ')}.`,
      },
      { status: 400 }
    );
  }

  if (typeof body.amount !== 'number' || body.amount <= 0) {
    return NextResponse.json(
      { success: false, error: 'Le montant doit être un nombre positif.' },
      { status: 400 }
    );
  }

  if (!validatePhoneNumber(body.phoneNumber)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Numéro de téléphone DRC invalide. Format attendu: 243XXXXXXXXX ou 0XXXXXXXXX.',
      },
      { status: 400 }
    );
  }

  const paymentRequest: PaymentRequest = {
    provider: body.provider as PaymentProvider,
    phoneNumber: body.phoneNumber,
    amount: body.amount,
    currency: body.currency || 'CDF',
    reference: body.reference,
    description: body.description || `Paiement ${body.reference}`,
    callbackUrl: body.callbackUrl,
  };

  try {
    const service = new MobileMoneyService();
    const response = await service.initiatePayment(paymentRequest);

    return NextResponse.json(response, {
      status: response.success ? 200 : 422,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur.';
    console.error('[payments/initiate] Error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
