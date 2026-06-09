'use client';

import { useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import styles from '../../store.module.css';
import MobileMoneyForm, { MobileMoneyProvider } from '@/components/commerce/MobileMoneyForm';

// Demo cart items (in a real app these would come from context/state)
const DEMO_ITEMS = [
  { name: 'Robe fleurie', qty: 1, price: 45000, currency: 'CDF' },
  { name: 'Lunettes de soleil', qty: 2, price: 28000, currency: 'CDF' },
];

interface OrderForm {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
}

type OrderStep = 'details' | 'payment' | 'success';

function genRef() {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [step, setStep] = useState<OrderStep>('details');
  const [orderRef] = useState(genRef);
  const [txId, setTxId] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<MobileMoneyProvider | null>(null);
  const [form, setForm] = useState<OrderForm>({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: 'Kinshasa',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<OrderForm>>({});

  const currency = DEMO_ITEMS[0]?.currency || 'CDF';
  const subtotal = DEMO_ITEMS.reduce((sum, i) => sum + i.price * i.qty, 0);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function validateDetails(): boolean {
    const errors: Partial<OrderForm> = {};
    if (!form.firstName) errors.firstName = 'Requis';
    if (!form.lastName) errors.lastName = 'Requis';
    if (!form.phone) errors.phone = 'Requis';
    if (!form.address) errors.address = 'Requis';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleDetailsNext(e: React.FormEvent) {
    e.preventDefault();
    if (validateDetails()) setStep('payment');
  }

  function handlePaymentSuccess(transactionId: string, provider: MobileMoneyProvider) {
    setTxId(transactionId);
    setPaymentProvider(provider);
    setStep('success');
  }

  if (step === 'success') {
    return (
      <div className={styles.checkoutPage}>
        <header className={styles.checkoutHeader}>
          <Link href={`/store/${slug}`} className={styles.checkoutBack}>
            ← Boutique
          </Link>
          <span className={styles.checkoutTitle}>Commande confirmée</span>
        </header>
        <div className={styles.checkoutContent}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>🎉</div>
            <h1 className={styles.successTitle}>Merci pour votre commande !</h1>
            <p className={styles.successDesc}>
              Votre paiement a été reçu. Le vendeur préparera votre commande et vous contactera via WhatsApp.
            </p>
            <div className={styles.successTxId}>
              Référence : {orderRef}<br />
              Transaction : {txId}
            </div>
            <div className={styles.pendingNotice}>
              Vous recevrez une confirmation par SMS au numéro indiqué. En cas de problème, contactez le vendeur via WhatsApp.
            </div>
            <Link
              href={`/store/${slug}`}
              style={{
                display: 'block',
                padding: '0.875rem',
                background: 'linear-gradient(135deg, #3730a3, #4f46e5)',
                color: 'white',
                borderRadius: 10,
                fontWeight: 700,
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Retour à la boutique
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.checkoutPage}>
      <header className={styles.checkoutHeader}>
        <Link href={`/store/${slug}`} className={styles.checkoutBack}>
          ← Boutique
        </Link>
        <span className={styles.checkoutTitle}>
          {step === 'details' ? 'Vos informations' : 'Paiement'}
        </span>
      </header>

      <div className={styles.checkoutContent}>
        {/* Order summary */}
        <div className={styles.checkoutSection}>
          <div className={styles.checkoutSectionTitle}>Récapitulatif de la commande</div>
          {DEMO_ITEMS.map((item) => (
            <div key={item.name} className={styles.orderSummaryRow}>
              <span>{item.name} × {item.qty}</span>
              <span style={{ fontWeight: 600 }}>{(item.price * item.qty).toLocaleString('fr-CD')} {currency}</span>
            </div>
          ))}
          <div className={styles.orderSummaryRow}>
            <span>Total</span>
            <span>{subtotal.toLocaleString('fr-CD')} {currency}</span>
          </div>
        </div>

        {step === 'details' && (
          <form onSubmit={handleDetailsNext} noValidate>
            <div className={styles.checkoutSection}>
              <div className={styles.checkoutSectionTitle}>Informations de livraison</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Prénom *</label>
                    <input
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      className={styles.input}
                      style={formErrors.firstName ? { borderColor: '#dc2626' } : {}}
                    />
                    {formErrors.firstName && <span style={{ fontSize: '0.72rem', color: '#dc2626' }}>{formErrors.firstName}</span>}
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Nom *</label>
                    <input
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      className={styles.input}
                      style={formErrors.lastName ? { borderColor: '#dc2626' } : {}}
                    />
                    {formErrors.lastName && <span style={{ fontSize: '0.72rem', color: '#dc2626' }}>{formErrors.lastName}</span>}
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Téléphone *</label>
                  <div className={styles.phonePrefixGroup}>
                    <span className={styles.phonePrefix}>+243</span>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className={styles.input}
                      placeholder="8X XXX XXXX"
                      style={formErrors.phone ? { borderColor: '#dc2626' } : {}}
                    />
                  </div>
                  {formErrors.phone && <span style={{ fontSize: '0.72rem', color: '#dc2626' }}>{formErrors.phone}</span>}
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Adresse de livraison *</label>
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="Rue, quartier, commune"
                    style={formErrors.address ? { borderColor: '#dc2626' } : {}}
                  />
                  {formErrors.address && <span style={{ fontSize: '0.72rem', color: '#dc2626' }}>{formErrors.address}</span>}
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Ville</label>
                  <input name="city" value={form.city} onChange={handleChange} className={styles.input} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Notes (optionnel)</label>
                  <input name="notes" value={form.notes} onChange={handleChange} className={styles.input} placeholder="Instructions particulières…" />
                </div>
              </div>
            </div>

            <button type="submit" className={styles.placeOrderBtn}>
              Continuer vers le paiement
            </button>
          </form>
        )}

        {step === 'payment' && (
          <>
            <div className={styles.checkoutSection}>
              <div className={styles.checkoutSectionTitle}>Paiement Mobile Money</div>
              <MobileMoneyForm
                amount={subtotal}
                currency={currency}
                orderReference={orderRef}
                onSuccess={handlePaymentSuccess}
              />
            </div>
            <button
              onClick={() => setStep('details')}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                width: '100%',
                padding: '0.5rem',
              }}
            >
              ← Modifier mes informations
            </button>
          </>
        )}
      </div>
    </div>
  );
}
