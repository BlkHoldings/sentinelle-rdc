'use client';

import { useState } from 'react';
import styles from '../dashboard.module.css';
import paymentStyles from './payments.module.css';

interface ProviderConfig {
  enabled: boolean;
  apiKey: string;
  shortCode: string;
  environment: 'sandbox' | 'production';
}

interface PaymentSettings {
  mpesa: ProviderConfig;
  orangeMoney: ProviderConfig;
  airtelMoney: ProviderConfig;
  currency: string;
  commissionRate: number;
}

const initialSettings: PaymentSettings = {
  mpesa: { enabled: true, apiKey: '', shortCode: '', environment: 'sandbox' },
  orangeMoney: { enabled: false, apiKey: '', shortCode: '', environment: 'sandbox' },
  airtelMoney: { enabled: false, apiKey: '', shortCode: '', environment: 'sandbox' },
  currency: 'CDF',
  commissionRate: 1.5,
};

const recentTransactions = [
  { id: 'TXN-8821', amount: '45 000 CDF', method: 'M-Pesa', status: 'Réussi', date: '09/06 14:22', customer: 'Marie Mbuyi' },
  { id: 'TXN-8820', amount: '85 000 CDF', method: 'Orange Money', status: 'En attente', date: '09/06 11:10', customer: 'Paul Ngoy' },
  { id: 'TXN-8819', amount: '62 000 CDF', method: 'Airtel Money', status: 'Réussi', date: '08/06 16:45', customer: 'Cécile T.' },
  { id: 'TXN-8818', amount: '56 000 CDF', method: 'M-Pesa', status: 'Réussi', date: '08/06 09:30', customer: 'Roger K.' },
  { id: 'TXN-8817', amount: '38 000 CDF', method: 'Orange Money', status: 'Échoué', date: '07/06 18:05', customer: 'Diane L.' },
];

const txStatusStyle: Record<string, string> = {
  'Réussi': styles.badgeGreen,
  'En attente': styles.badgeYellow,
  'Échoué': styles.badgeRed,
};

type Provider = 'mpesa' | 'orangeMoney' | 'airtelMoney';

const providerMeta: Record<Provider, { name: string; color: string; icon: string; description: string }> = {
  mpesa: { name: 'M-Pesa (Vodacom)', color: '#E11D48', icon: '🔴', description: 'Réseau Vodacom DRC — Numéro commençant par 08' },
  orangeMoney: { name: 'Orange Money', color: '#F97316', icon: '🟠', description: 'Réseau Orange DRC — Numéro commençant par 09' },
  airtelMoney: { name: 'Airtel Money', color: '#DC2626', icon: '🔴', description: 'Réseau Airtel DRC — Numéro commençant par 09' },
};

export default function PaymentsPage() {
  const [settings, setSettings] = useState<PaymentSettings>(initialSettings);
  const [saved, setSaved] = useState(false);
  const [activeProvider, setActiveProvider] = useState<Provider>('mpesa');

  function toggleProvider(p: Provider) {
    setSettings((prev) => ({
      ...prev,
      [p]: { ...prev[p], enabled: !prev[p].enabled },
    }));
  }

  function updateField(p: Provider, field: keyof ProviderConfig, value: string | boolean) {
    setSettings((prev) => ({
      ...prev,
      [p]: { ...prev[p], [field]: value },
    }));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <>
      <div className={styles.topbar}>
        <span className={styles.topbarTitle}>Paiements Mobile Money</span>
        <div className={styles.topbarActions}>
          <button className={styles.topbarBtnPrimary} onClick={handleSave}>
            {saved ? '✓ Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Balance cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statCardLabel}>Solde disponible</div>
            <div className={styles.statCardValue}>873 250</div>
            <div className={`${styles.statCardChange} ${styles.changePositive}`}>CDF</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statCardLabel}>En traitement</div>
            <div className={styles.statCardValue}>147 000</div>
            <div className={`${styles.statCardChange} ${styles.changeNegative}`}>CDF</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statCardLabel}>Transactions ce mois</div>
            <div className={styles.statCardValue}>87</div>
            <div className={`${styles.statCardChange} ${styles.changePositive}`}>↑ 12 vs mois dernier</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statCardLabel}>Taux de succès</div>
            <div className={styles.statCardValue}>96.2%</div>
            <div className={`${styles.statCardChange} ${styles.changePositive}`}>↑ 1.4%</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Provider config */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Configuration des fournisseurs</div>
            <div className={paymentStyles.providerTabs}>
              {(Object.keys(providerMeta) as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveProvider(p)}
                  className={`${paymentStyles.providerTab} ${activeProvider === p ? paymentStyles.providerTabActive : ''}`}
                >
                  {providerMeta[p].icon} {p === 'mpesa' ? 'M-Pesa' : p === 'orangeMoney' ? 'Orange' : 'Airtel'}
                </button>
              ))}
            </div>

            {(Object.keys(providerMeta) as Provider[]).map((p) => (
              activeProvider === p && (
                <div key={p} className={paymentStyles.providerConfig}>
                  <div className={paymentStyles.providerHeader} style={{ borderLeftColor: providerMeta[p].color }}>
                    <div>
                      <div className={paymentStyles.providerName}>{providerMeta[p].name}</div>
                      <div className={paymentStyles.providerDesc}>{providerMeta[p].description}</div>
                    </div>
                    <label className={paymentStyles.toggle}>
                      <input
                        type="checkbox"
                        checked={settings[p].enabled}
                        onChange={() => toggleProvider(p)}
                      />
                      <span className={paymentStyles.toggleSlider} />
                    </label>
                  </div>

                  {settings[p].enabled && (
                    <div className={paymentStyles.configFields}>
                      <div className={paymentStyles.fieldGroup}>
                        <label className={paymentStyles.label}>Clé API</label>
                        <input
                          type="password"
                          placeholder="••••••••••••••••"
                          value={settings[p].apiKey}
                          onChange={(e) => updateField(p, 'apiKey', e.target.value)}
                          className={paymentStyles.input}
                        />
                      </div>
                      <div className={paymentStyles.fieldGroup}>
                        <label className={paymentStyles.label}>Code court (Short Code)</label>
                        <input
                          type="text"
                          placeholder="Ex: 174379"
                          value={settings[p].shortCode}
                          onChange={(e) => updateField(p, 'shortCode', e.target.value)}
                          className={paymentStyles.input}
                        />
                      </div>
                      <div className={paymentStyles.fieldGroup}>
                        <label className={paymentStyles.label}>Environnement</label>
                        <select
                          value={settings[p].environment}
                          onChange={(e) => updateField(p, 'environment', e.target.value)}
                          className={paymentStyles.input}
                        >
                          <option value="sandbox">Sandbox (test)</option>
                          <option value="production">Production</option>
                        </select>
                      </div>
                      <div className={paymentStyles.sandboxNote}>
                        {settings[p].environment === 'sandbox'
                          ? 'Mode test activé. Les paiements ne seront pas réels.'
                          : 'Mode production actif. Les paiements sont réels.'}
                      </div>
                    </div>
                  )}
                </div>
              )
            ))}

            <div className={paymentStyles.generalSettings}>
              <div className={paymentStyles.fieldGroup}>
                <label className={paymentStyles.label}>Devise par défaut</label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings((prev) => ({ ...prev, currency: e.target.value }))}
                  className={paymentStyles.input}
                >
                  <option value="CDF">Franc Congolais (CDF)</option>
                  <option value="USD">Dollar Américain (USD)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recent transactions */}
          <div>
            <div className={styles.tableCard}>
              <div className={styles.tableCardHeader}>
                <span className={styles.tableCardTitle}>Transactions récentes</span>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Client</th>
                    <th>Montant</th>
                    <th>Méthode</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontWeight: 700, color: '#3730a3', fontSize: '0.8rem' }}>{tx.id}</td>
                      <td style={{ fontSize: '0.8rem' }}>{tx.customer}</td>
                      <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{tx.amount}</td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeGray}`} style={{ fontSize: '0.7rem' }}>{tx.method}</span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${txStatusStyle[tx.status]}`} style={{ fontSize: '0.7rem' }}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Webhook info */}
            <div className={styles.card}>
              <div className={styles.cardTitle}>URL Webhook</div>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem', lineHeight: 1.6 }}>
                Configurez cette URL dans votre tableau de bord opérateur pour recevoir les notifications de paiement.
              </p>
              <div className={paymentStyles.webhookUrl}>
                <code>https://votre-domaine.com/api/payments/webhook</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
