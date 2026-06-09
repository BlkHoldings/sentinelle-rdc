'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../auth.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    // Simulate auth (no real backend)
    await new Promise((r) => setTimeout(r, 900));
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
          Bienvenue<br />sur votre <span>espace marchand</span>
        </h1>
        <p className={styles.leftDesc}>
          Gérez votre boutique, suivez vos commandes et encaissez en Mobile Money depuis un seul endroit.
        </p>
        <div className={styles.leftFeatures}>
          <div className={styles.leftFeature}>
            <span className={styles.leftFeatureIcon}>✓</span>
            Tableau de bord en temps réel
          </div>
          <div className={styles.leftFeature}>
            <span className={styles.leftFeatureIcon}>✓</span>
            M-Pesa, Orange Money, Airtel Money
          </div>
          <div className={styles.leftFeature}>
            <span className={styles.leftFeatureIcon}>✓</span>
            Vente sur WhatsApp &amp; Instagram
          </div>
          <div className={styles.leftFeature}>
            <span className={styles.leftFeatureIcon}>✓</span>
            Support en français 24h/24
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className={styles.right}>
        <div className={styles.formBox}>
          <h2 className={styles.formTitle}>Connexion</h2>
          <p className={styles.formSubtitle}>
            Pas encore de compte ?{' '}
            <Link href="/auth/register">Créer un compte gratuit</Link>
          </p>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="email">Adresse email</label>
              <input
                className={styles.input}
                type="email"
                id="email"
                name="email"
                placeholder="vous@exemple.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="password">Mot de passe</label>
              <input
                className={styles.input}
                type="password"
                id="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>

            <div className={styles.forgotLink}>
              <a href="#">Mot de passe oublié ?</a>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>

          <p className={styles.termsNote} style={{ marginTop: '1.5rem' }}>
            En vous connectant, vous acceptez nos{' '}
            <a href="#">Conditions d&apos;utilisation</a> et notre{' '}
            <a href="#">Politique de confidentialité</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
