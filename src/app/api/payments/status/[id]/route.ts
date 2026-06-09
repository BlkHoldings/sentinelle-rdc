import { NextRequest, NextResponse } from 'next/server';
import { MobileMoneyService, PaymentProvider } from '@/lib/mobile-money';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  if (!id || id.trim() === '') {
    return NextResponse.json(
      { error: 'ID de transaction manquant.' },
      { status: 400 }
    );
  }

  // Infer provider from transaction ID prefix (set during initiation)
  let provider: PaymentProvider;
  if (id.startsWith('MPESA_')) {
    provider = PaymentProvider.MPESA;
  } else if (id.startsWith('OM_')) {
    provider = PaymentProvider.ORANGE_MONEY;
  } else if (id.startsWith('AM_')) {
    provider = PaymentProvider.AIRTEL_MONEY;
  } else {
    // Allow explicit provider via query param as fallback
    const { searchParams } = new URL(request.url);
    const providerParam = searchParams.get('provider');
    if (providerParam && Object.values(PaymentProvider).includes(providerParam as PaymentProvider)) {
      provider = providerParam as PaymentProvider;
    } else {
      return NextResponse.json(
        {
          error: `Impossible de déterminer le fournisseur pour l'ID: ${id}. Ajoutez ?provider=MPESA|ORANGE_MONEY|AIRTEL_MONEY.`,
        },
        { status: 400 }
      );
    }
  }

  try {
    const service = new MobileMoneyService();
    const status = await service.checkPaymentStatus(provider, id);
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur.';
    console.error('[payments/status] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
