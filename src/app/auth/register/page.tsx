'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../auth.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    storeName: '',
    phone: '',
    email: '',
    password: '',
    acceptTerms: false,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.firstName) newErrors.firstName = 'Requis';
    if (!form.lastName) newErrors.lastName = 'Requis';
    if (!form.storeName) newErrors.storeName = 'Requis';
    if (!form.phone) newErrors.phone = 'Requis';
    if (!form.email) newErrors.email = 'Requis';
    if (!form.password || form.password.length < 8) newErrors.password = 'Minimum 8 caractères';
    if (!form.acceptTerms) newErrors.acceptTerms = 'Veuillez accepter les conditions';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    // Simulate registration (no real backend)
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    router.push('/dashboard');
  }

  return (
    <div className={styles.page}>
      {/* LEFT PANEL */}
      <div className={styles.left}>
        <Link href="/" className={styles.leftLogo}>
          <span className={styles.leftLogoIcon}>C</span>
          Commerce Opus DRC
        </Link>
        <h1 className={styles.leftTitle}>
          Lancez votre<br />boutique en <span>3 clics</span>
        </h1>
        <p className={styles.leftDesc}>
          Rejoignez plus de 2 500 commerçants congolais qui développent leur business en ligne avec Commerce Opus.
        </p>
        <div className={styles.leftFeatures}>
          <div className={styles.leftFeature}>
            <span className={styles.leftFeatureIcon}>✓</span>
            7 jours d&apos;essai gratuit, sans carte bancaire
          </div>
          <div className={styles.leftFeature}>
            <span className={styles.leftFeatureIcon}>✓</span>
            Boutique prête en moins de 3 minutes
          </div>
          <div className={styles.leftFeature}>
            <span className={styles.leftFeatureIcon}>✓</span>
            Paiements mobile money instantanés
          </div>
          <div className={styles.leftFeature}>
            <span className={styles.leftFeatureIcon}>✓</span>
            Annulez à tout moment
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className={styles.right}>
        <div className={styles.formBox}>
          <h2 className={styles.formTitle}>Créer un compte</h2>
          <p className={styles.formSubtitle}>
            Déjà un compte ?{' '}
            <Link href="/auth/login">Se connecter</Link>
          </p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.formRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="firstName">Prénom</label>
                <input
                  className={styles.input}
                  style={errors.firstName ? { borderColor: '#dc2626' } : {}}
                  type="text"
                  id="firstName"
                  name="firstName"
                  placeholder="Jean"
                  value={form.firstName}
                  onChange={handleChange}
                  autoComplete="given-name"
                />
                {errors.firstName && <span className={styles.inputHint} style={{ color: '#dc2626' }}>{errors.firstName}</span>}
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="lastName">Nom</label>
                <input
                  className={styles.input}
                  style={errors.lastName ? { borderColor: '#dc2626' } : {}}
                  type="text"
                  id="lastName"
                  name="lastName"
                  placeholder="Kabila"
                  value={form.lastName}
                  onChange={handleChange}
                  autoComplete="family-name"
                />
                {errors.lastName && <span className={styles.inputHint} style={{ color: '#dc2626' }}>{errors.lastName}</span>}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="storeName">Nom de votre boutique</label>
              <input
                className={styles.input}
                style={errors.storeName ? { borderColor: '#dc2626' } : {}}
                type="text"
                id="storeName"
                name="storeName"
                placeholder="Ma Boutique Kinshasa"
                value={form.storeName}
                onChange={handleChange}
              />
              {form.storeName && (
                <span className={styles.inputHint}>
                  Votre boutique sera sur : /store/{form.storeName.toLowerCase().replace(/\s+/g, '-')}
                </span>
              )}
              {errors.storeName && <span className={styles.inputHint} style={{ color: '#dc2626' }}>{errors.storeName}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="phone">Numéro de téléphone (DRC)</label>
              <div className={styles.phonePrefixGroup}>
                <span className={styles.phonePrefix}>+243</span>
                <input
                  className={styles.input}
                  style={errors.phone ? { borderColor: '#dc2626' } : {}}
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="8X XXX XXXX"
                  value={form.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                />
              </div>
              <span className={styles.inputHint}>Utilisé pour les notifications et le paiement mobile</span>
              {errors.phone && <span className={styles.inputHint} style={{ color: '#dc2626' }}>{errors.phone}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="email">Adresse email</label>
              <input
                className={styles.input}
                style={errors.email ? { borderColor: '#dc2626' } : {}}
                type="email"
                id="email"
                name="email"
                placeholder="vous@exemple.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.email && <span className={styles.inputHint} style={{ color: '#dc2626' }}>{errors.email}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="password">Mot de passe</label>
              <input
                className={styles.input}
                style={errors.password ? { borderColor: '#dc2626' } : {}}
                type="password"
                id="password"
                name="password"
                placeholder="Minimum 8 caractères"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
              />
              {errors.password && <span className={styles.inputHint} style={{ color: '#dc2626' }}>{errors.password}</span>}
            </div>

            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="acceptTerms"
                name="acceptTerms"
                checked={form.acceptTerms}
                onChange={handleChange}
              />
              <label htmlFor="acceptTerms">
                J&apos;accepte les <a href="#">Conditions d&apos;utilisation</a> et la{' '}
                <a href="#">Politique de confidentialité</a> de Commerce Opus DRC
              </label>
            </div>
            {errors.acceptTerms && (
              <span className={styles.inputHint} style={{ color: '#dc2626' }}>{errors.acceptTerms}</span>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? 'Création en cours…' : 'Créer ma boutique gratuitement'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
