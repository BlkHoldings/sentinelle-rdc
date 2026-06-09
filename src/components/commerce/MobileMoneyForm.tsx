'use client';

import { useState } from 'react';
import styles from './MobileMoneyForm.module.css';

export type MobileMoneyProvider = 'MPESA' | 'ORANGE_MONEY' | 'AIRTEL_MONEY';

export interface MobileMoneyFormProps {
  amount: number;
  currency: string;
  orderReference: string;
  onSuccess: (transactionId: string, provider: MobileMoneyProvider) => void;
  onError?: (message: string) => void;
}

interface PaymentState {
  status: 'idle' | 'loading' | 'pending' | 'success' | 'error';
  transactionId?: string;
  message?: string;
}

const providers: Array<{ id: MobileMoneyProvider; name: string; icon: string; sub: string; prefix: string }> = [
  { id: 'MPESA', name: 'M-Pesa', icon: '🔴', sub: 'Vodacom DRC — 08X XXX XXXX', prefix: '081/082/083' },
  { id: 'ORANGE_MONEY', name: 'Orange Money', icon: '🟠', sub: 'Orange DRC — 09X XXX XXXX', prefix: '096/097/098' },
  { id: 'AIRTEL_MONEY', name: 'Airtel Money', icon: '🔴', sub: 'Airtel DRC — 09X XXX XXXX', prefix: '099' },
];

function formatPrice(amount: number, currency: string) {
  return amount.toLocaleString('fr-CD') + ' ' + currency;
}

export default function MobileMoneyForm({
  amount,
  currency,
  orderReference,
  onSuccess,
  onError,
}: MobileMoneyFormProps) {
  const [selected, setSelected] = useState<MobileMoneyProvider>('MPESA');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [payment, setPayment] = useState<PaymentState>({ status: 'idle' });

  function validatePhone(p: string): boolean {
    const cleaned = p.replace(/\D/g, '');
    return cleaned.length >= 9 && cleaned.length <= 10;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError('');

    if (!validatePhone(phone)) {
      setPhoneError('Numéro invalide. Entrez 9 à 10 chiffres.');
      return;
    }

    setPayment({ status: 'loading' });

    try {
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selected,
          phoneNumber: `+243${phone.replace(/\D/g, '')}`,
          amount,
          currency,
          reference: orderReference,
          description: `Commande ${orderReference}`,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        transactionId: string;
        status: string;
        message: string;
      };

      if (data.success) {
        setPayment({ status: 'pending', transactionId: data.transactionId, message: data.message });
        // Poll for completion after 5s (simplified)
        setTimeout(() => {
          // Simulate success for demo
          setPayment({ status: 'success', transactionId: data.transactionId });
          onSuccess(data.transactionId, selected);
        }, 5000);
      } else {
        const errMsg = data.message || 'Échec de l\'initiation du paiement.';
        setPayment({ status: 'error', message: errMsg });
        onError?.(errMsg);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erreur réseau.';
      setPayment({ status: 'error', message: errMsg });
      onError?.(errMsg);
    }
  }

  if (payment.status === 'success') {
    return (
      <div className={styles.successBox}>
        <div className={styles.successTitle}>Paiement confirmé !</div>
        <div>Transaction ID : {payment.transactionId}</div>
        <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', opacity: 0.8 }}>
          Merci pour votre achat. Vous recevrez une confirmation par SMS.
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.title}>
        Payer {formatPrice(amount, currency)} via Mobile Money
      </div>

      {/* Provider selection */}
      <div className={styles.providerList}>
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.providerOption} ${selected === p.id ? styles.providerOptionActive : ''}`}
            onClick={() => { setSelected(p.id); setPayment({ status: 'idle' }); }}
            disabled={payment.status === 'loading' || payment.status === 'pending'}
          >
            <span className={styles.providerIcon}>{p.icon}</span>
            <span className={styles.providerInfo}>
              <span className={styles.providerName}>{p.name}</span>
              <span className={styles.providerSub}>{p.sub}</span>
            </span>
            <span className={`${styles.radioCircle} ${selected === p.id ? styles.radioCircleActive : ''}`} />
          </button>
        ))}
      </div>

      {/* Phone number */}
      <div className={styles.phoneGroup}>
        <label className={styles.phoneLabel}>Numéro de téléphone Mobile Money</label>
        <div className={styles.phonePrefixRow}>
          <span className={styles.phonePrefix}>+243</span>
          <input
            type="tel"
            className={styles.phoneInput}
            placeholder="8X XXX XXXX"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setPhoneError(''); }}
            disabled={payment.status === 'loading' || payment.status === 'pending'}
            autoComplete="tel"
          />
        </div>
        {phoneError ? (
          <span className={styles.phoneError}>{phoneError}</span>
        ) : (
          <span className={styles.phoneHint}>
            Entrez le numéro associé à votre compte {providers.find((p) => p.id === selected)?.name}
          </span>
        )}
      </div>

      {/* Pending state */}
      {payment.status === 'pending' && (
        <div className={styles.pendingBox}>
          <div className={styles.pendingTitle}>En attente de confirmation</div>
          <div>{payment.message}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', opacity: 0.8 }}>
            Vérifiez votre téléphone et entrez votre code PIN pour valider.
          </div>
        </div>
      )}

      {/* Error state */}
      {payment.status === 'error' && (
        <div className={styles.errorBox}>
          {payment.message}
        </div>
      )}

      {/* Submit */}
      {payment.status !== 'pending' && (
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={payment.status === 'loading'}
        >
          {payment.status === 'loading'
            ? 'Traitement en cours…'
            : `Payer ${formatPrice(amount, currency)}`}
        </button>
      )}

      <div className={styles.secureNote}>
        Paiement sécurisé · Crypté SSL
      </div>
    </form>
  );
}
