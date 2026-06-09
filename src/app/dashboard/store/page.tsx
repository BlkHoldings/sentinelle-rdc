'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '../dashboard.module.css';
import storeStyles from './store.module.css';

interface StoreSettings {
  name: string;
  slug: string;
  description: string;
  phone: string;
  whatsapp: string;
  city: string;
  theme: 'indigo' | 'green' | 'orange' | 'rose';
  logo: string;
  coverColor: string;
  showInstagram: boolean;
  instagramHandle: string;
  currency: string;
}

const initialSettings: StoreSettings = {
  name: 'Ma Boutique Kinshasa',
  slug: 'ma-boutique-kinshasa',
  description: 'Vêtements et accessoires de mode pour femmes et hommes à Kinshasa.',
  phone: '+243 81 234 5678',
  whatsapp: '+243812345678',
  city: 'Kinshasa, RDC',
  theme: 'indigo',
  logo: 'MBK',
  coverColor: '#3730a3',
  showInstagram: true,
  instagramHandle: '@maboutique_kin',
  currency: 'CDF',
};

const themes = [
  { id: 'indigo', label: 'Indigo', color: '#3730a3' },
  { id: 'green', label: 'Vert', color: '#16a34a' },
  { id: 'orange', label: 'Orange', color: '#ea580c' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
] as const;

export default function StoreCustomizationPage() {
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [saved, setSaved] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function setTheme(t: StoreSettings['theme']) {
    const themeColors: Record<string, string> = { indigo: '#3730a3', green: '#16a34a', orange: '#ea580c', rose: '#e11d48' };
    setSettings((prev) => ({ ...prev, theme: t, coverColor: themeColors[t] }));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <>
      <div className={styles.topbar}>
        <span className={styles.topbarTitle}>Ma boutique</span>
        <div className={styles.topbarActions}>
          <Link href={`/store/${settings.slug}`} className={styles.topbarBtnPrimary} target="_blank">
            Voir la boutique
          </Link>
          <button className={styles.topbarBtnPrimary} onClick={handleSave} style={{ background: saved ? 'linear-gradient(135deg, #16a34a, #22c55e)' : undefined }}>
            {saved ? '✓ Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
          {/* Settings form */}
          <div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Informations générales</div>
              <div className={storeStyles.fields}>
                <div className={storeStyles.fieldGroup}>
                  <label className={storeStyles.label}>Nom de la boutique *</label>
                  <input name="name" value={settings.name} onChange={handleChange} className={storeStyles.input} />
                </div>
                <div className={storeStyles.fieldGroup}>
                  <label className={storeStyles.label}>URL de la boutique</label>
                  <div className={storeStyles.urlGroup}>
                    <span className={storeStyles.urlPrefix}>/store/</span>
                    <input
                      name="slug"
                      value={settings.slug}
                      onChange={handleChange}
                      className={storeStyles.input}
                      style={{ borderRadius: '0 8px 8px 0' }}
                    />
                  </div>
                </div>
                <div className={storeStyles.fieldGroup}>
                  <label className={storeStyles.label}>Description</label>
                  <textarea name="description" value={settings.description} onChange={handleChange} className={storeStyles.textarea} rows={3} />
                </div>
                <div className={storeStyles.formRow}>
                  <div className={storeStyles.fieldGroup}>
                    <label className={storeStyles.label}>Téléphone</label>
                    <input name="phone" value={settings.phone} onChange={handleChange} className={storeStyles.input} />
                  </div>
                  <div className={storeStyles.fieldGroup}>
                    <label className={storeStyles.label}>WhatsApp</label>
                    <input name="whatsapp" value={settings.whatsapp} onChange={handleChange} className={storeStyles.input} />
                  </div>
                </div>
                <div className={storeStyles.formRow}>
                  <div className={storeStyles.fieldGroup}>
                    <label className={storeStyles.label}>Ville</label>
                    <input name="city" value={settings.city} onChange={handleChange} className={storeStyles.input} />
                  </div>
                  <div className={storeStyles.fieldGroup}>
                    <label className={storeStyles.label}>Devise</label>
                    <select name="currency" value={settings.currency} onChange={handleChange} className={storeStyles.input}>
                      <option value="CDF">CDF</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Apparence</div>
              <div className={storeStyles.fields}>
                <div className={storeStyles.fieldGroup}>
                  <label className={storeStyles.label}>Thème de couleur</label>
                  <div className={storeStyles.themeGrid}>
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`${storeStyles.themeBtn} ${settings.theme === t.id ? storeStyles.themeBtnActive : ''}`}
                        style={{ '--theme-color': t.color } as React.CSSProperties}
                      >
                        <span className={storeStyles.themeColorDot} style={{ background: t.color }} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={storeStyles.fieldGroup}>
                  <label className={storeStyles.label}>Initiales du logo</label>
                  <input name="logo" value={settings.logo} onChange={handleChange} className={storeStyles.input} maxLength={3} placeholder="Ex: MBK" />
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>1 à 3 lettres affichées dans le logo</span>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Réseaux sociaux</div>
              <div className={storeStyles.fields}>
                <div className={storeStyles.checkboxRow}>
                  <input type="checkbox" id="showInstagram" name="showInstagram" checked={settings.showInstagram} onChange={handleChange} />
                  <label htmlFor="showInstagram" className={storeStyles.checkboxLabel}>Afficher le lien Instagram</label>
                </div>
                {settings.showInstagram && (
                  <div className={storeStyles.fieldGroup}>
                    <label className={storeStyles.label}>Compte Instagram</label>
                    <input name="instagramHandle" value={settings.instagramHandle} onChange={handleChange} className={storeStyles.input} placeholder="@votre_boutique" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className={storeStyles.previewWrapper}>
            <div className={storeStyles.previewLabel}>Aperçu de la boutique</div>
            <div className={storeStyles.phoneFrame}>
              <div className={storeStyles.storePreview}>
                <div className={storeStyles.previewCover} style={{ background: settings.coverColor }}>
                  <div className={storeStyles.previewLogo}>{settings.logo || 'MB'}</div>
                  <div className={storeStyles.previewStoreName}>{settings.name || 'Ma Boutique'}</div>
                  <div className={storeStyles.previewCity}>{settings.city}</div>
                </div>
                <div className={storeStyles.previewBody}>
                  <div className={storeStyles.previewDesc}>{settings.description || 'Description de votre boutique…'}</div>
                  <div className={storeStyles.previewProductGrid}>
                    {['Produit 1', 'Produit 2', 'Produit 3', 'Produit 4'].map((p) => (
                      <div key={p} className={storeStyles.previewProduct}>
                        <div className={storeStyles.previewProductImg} style={{ background: settings.coverColor + '22' }} />
                        <div className={storeStyles.previewProductName}>{p}</div>
                        <div className={storeStyles.previewProductPrice} style={{ color: settings.coverColor }}>45 000 CDF</div>
                      </div>
                    ))}
                  </div>
                  <button className={storeStyles.previewWhatsapp} style={{ background: '#16a34a' }}>
                    Commander via WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
