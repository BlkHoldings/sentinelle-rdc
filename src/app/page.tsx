import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>
      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}>C</span>
            Commerce Opus DRC
          </Link>
          <ul className={styles.navLinks}>
            <li><a href="#fonctionnalites">Fonctionnalités</a></li>
            <li><a href="#comment-ca-marche">Comment ça marche</a></li>
            <li><a href="#paiements">Paiements</a></li>
            <li><a href="#tarifs">Tarifs</a></li>
          </ul>
          <div className={styles.navCta}>
            <Link href="/auth/login" className={styles.btnOutline}>Se connecter</Link>
            <Link href="/auth/register" className={styles.btnPrimary}>Commencer gratuitement</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>
            Nouveau — Paiements mobile money intégrés pour la RDC
          </div>
          <h1 className={styles.heroTitle}>
            Créez votre boutique<br />
            en <span>3 clics</span>, vendez sur<br />
            WhatsApp &amp; Instagram
          </h1>
          <p className={styles.heroSubtitle}>
            La plateforme e-commerce conçue pour les commerçants congolais.
            Acceptez M-Pesa, Orange Money et Airtel Money directement dans votre boutique.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/auth/register" className={styles.btnGreenLarge}>
              Créer ma boutique gratuitement
            </Link>
            <Link href="/store/demo" className={styles.btnPrimaryLarge} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}>
              Voir une démo
            </Link>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}>2 500+</div>
              <div className={styles.heroStatLabel}>Boutiques créées</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}>98%</div>
              <div className={styles.heroStatLabel}>Taux de satisfaction</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}>3 min</div>
              <div className={styles.heroStatLabel}>Pour lancer votre boutique</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatNum}>CDF / USD</div>
              <div className={styles.heroStatLabel}>Multi-devises</div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF STRIP */}
      <div className={styles.socialsRow}>
        <span className={styles.socialLabel}>Vend sur</span>
        <span className={styles.socialIcon}>WhatsApp</span>
        <span className={styles.socialLabel}>·</span>
        <span className={styles.socialIcon}>Instagram</span>
        <span className={styles.socialLabel}>·</span>
        <span className={styles.socialIcon}>Facebook</span>
        <span className={styles.socialLabel}>·</span>
        <span className={styles.socialLabel}>Kinshasa · Lubumbashi · Goma · Bukavu · Mbuji-Mayi</span>
      </div>

      {/* FEATURES */}
      <section className={styles.section} id="fonctionnalites">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Fonctionnalités</span>
            <h2 className={styles.sectionTitle}>Tout ce dont vous avez besoin<br />pour vendre en ligne</h2>
            <p className={styles.sectionDesc}>
              De la création de boutique à l&apos;encaissement, Commerce Opus gère tout pour vous.
            </p>
          </div>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.featureIconIndigo}`}>🏪</div>
              <h3 className={styles.featureTitle}>Boutique en 3 clics</h3>
              <p className={styles.featureDesc}>
                Créez votre boutique en ligne en moins de 3 minutes. Choisissez votre thème, ajoutez vos produits et partagez.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.featureIconGreen}`}>📱</div>
              <h3 className={styles.featureTitle}>Vente sociale</h3>
              <p className={styles.featureDesc}>
                Partagez votre lien boutique sur WhatsApp et Instagram. Vos clients commandent directement sans quitter l&apos;app.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.featureIconBlue}`}>💳</div>
              <h3 className={styles.featureTitle}>Paiement Mobile Money</h3>
              <p className={styles.featureDesc}>
                M-Pesa, Orange Money, Airtel Money. Vos clients paient avec leur téléphone, vous recevez instantanément.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.featureIconOrange}`}>📊</div>
              <h3 className={styles.featureTitle}>Analytiques en temps réel</h3>
              <p className={styles.featureDesc}>
                Suivez vos ventes, vos meilleurs produits et vos clients depuis votre tableau de bord mobile.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.featureIconIndigo}`}>📦</div>
              <h3 className={styles.featureTitle}>Gestion des commandes</h3>
              <p className={styles.featureDesc}>
                Recevez les commandes, mettez à jour les statuts et notifiez vos clients automatiquement par WhatsApp.
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles.featureIconGreen}`}>🌍</div>
              <h3 className={styles.featureTitle}>Multi-devises</h3>
              <p className={styles.featureDesc}>
                Vendez en Francs Congolais (CDF) ou en Dollars (USD). Gestion automatique des taux de change.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.sectionAlt} id="comment-ca-marche">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Comment ça marche</span>
            <h2 className={styles.sectionTitle}>Lancez votre boutique<br />en 3 étapes simples</h2>
          </div>
          <div className={styles.stepsGrid}>
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <h3 className={styles.stepTitle}>Créez votre boutique</h3>
              <p className={styles.stepDesc}>
                Inscrivez-vous, choisissez le nom de votre boutique et personnalisez votre vitrine en quelques minutes.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <h3 className={styles.stepTitle}>Ajoutez vos produits</h3>
              <p className={styles.stepDesc}>
                Importez vos produits avec photos et prix. Notre IA peut vous aider à rédiger les descriptions.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <h3 className={styles.stepTitle}>Partagez et vendez</h3>
              <p className={styles.stepDesc}>
                Partagez votre lien sur WhatsApp et Instagram. Recevez des commandes et des paiements 24h/24.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MOBILE MONEY SECTION */}
      <section className={styles.mobileMoneySection} id="paiements">
        <div className={styles.mobileMoneyContent}>
          <div className={styles.mobileMoneyText}>
            <div className={styles.sectionHeader} style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
              <span className={styles.sectionLabel}>Paiements Mobile Money</span>
              <h2 className={styles.sectionTitle}>Encaissez avec les 3 grands opérateurs de la RDC</h2>
              <p className={styles.sectionDesc}>
                Intégration native avec M-Pesa (Vodacom), Orange Money et Airtel Money.
                Vos clients paient en un clic, vous recevez en temps réel.
              </p>
            </div>
            <div className={styles.providersGrid}>
              <div className={styles.providerCard}>
                <div className={styles.providerLogo}>🔴</div>
                <div className={styles.providerName}>M-Pesa</div>
                <div className={styles.providerDesc}>Vodacom DRC</div>
              </div>
              <div className={styles.providerCard}>
                <div className={styles.providerLogo}>🟠</div>
                <div className={styles.providerName}>Orange Money</div>
                <div className={styles.providerDesc}>Orange DRC</div>
              </div>
              <div className={styles.providerCard}>
                <div className={styles.providerLogo}>🔴</div>
                <div className={styles.providerName}>Airtel Money</div>
                <div className={styles.providerDesc}>Airtel DRC</div>
              </div>
              <div className={styles.providerCard}>
                <div className={styles.providerLogo}>💚</div>
                <div className={styles.providerName}>Multi-devises</div>
                <div className={styles.providerDesc}>CDF &amp; USD</div>
              </div>
            </div>
          </div>
          <div className={styles.mobileMoneyVisual}>
            <div className={styles.phoneCard}>
              <div className={styles.phoneCardHeader}>Paiement sécurisé</div>
              <div className={styles.phoneCardAmount}>
                <div className={styles.phoneCardAmountNum}>25 000</div>
                <div className={styles.phoneCardAmountCurrency}>CDF</div>
              </div>
              <div className={styles.phoneProviderOptions}>
                <div className={`${styles.phoneProviderOption} ${styles.active}`}>
                  <span>🔴</span>
                  <span>M-Pesa</span>
                  <span className={`${styles.phoneDot} ${styles.selected}`}></span>
                </div>
                <div className={styles.phoneProviderOption}>
                  <span>🟠</span>
                  <span>Orange Money</span>
                  <span className={styles.phoneDot}></span>
                </div>
                <div className={styles.phoneProviderOption}>
                  <span>🔴</span>
                  <span>Airtel Money</span>
                  <span className={styles.phoneDot}></span>
                </div>
              </div>
              <button className={styles.phonePayBtn}>Payer maintenant</button>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className={styles.section} id="tarifs">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Tarifs</span>
            <h2 className={styles.sectionTitle}>Commencez gratuitement,<br />évoluez selon vos besoins</h2>
            <p className={styles.sectionDesc}>7 jours d&apos;essai gratuit sur tous les plans. Aucune carte bancaire requise.</p>
          </div>
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.pricingPlan}>Démarrage</div>
              <div className={styles.pricingPrice}>
                <span className={styles.pricingCurrency}>$</span>
                <span className={styles.pricingAmount}>0</span>
                <span className={styles.pricingPeriod}> / 7 jours</span>
              </div>
              <div className={styles.pricingDesc}>Idéal pour tester la plateforme et lancer votre première boutique.</div>
              <ul className={styles.pricingFeatures}>
                <li><span className={styles.checkIcon}>✓</span> 1 boutique</li>
                <li><span className={styles.checkIcon}>✓</span> 10 produits</li>
                <li><span className={styles.checkIcon}>✓</span> Mobile money (3%)</li>
                <li><span className={styles.checkIcon}>✓</span> Support email</li>
              </ul>
              <Link href="/auth/register" className={`${styles.pricingCta} ${styles.pricingCtaOutline}`}>
                Commencer gratuitement
              </Link>
            </div>
            <div className={`${styles.pricingCard} ${styles.pricingCardPopular}`}>
              <span className={styles.popularBadge}>Le plus populaire</span>
              <div className={styles.pricingPlan}>Pro</div>
              <div className={styles.pricingPrice}>
                <span className={styles.pricingCurrency}>$</span>
                <span className={styles.pricingAmount}>15</span>
                <span className={styles.pricingPeriod}> / mois</span>
              </div>
              <div className={styles.pricingDesc}>Pour les commerçants actifs qui veulent développer leurs ventes.</div>
              <ul className={styles.pricingFeatures}>
                <li><span className={styles.checkIcon}>✓</span> 3 boutiques</li>
                <li><span className={styles.checkIcon}>✓</span> Produits illimités</li>
                <li><span className={styles.checkIcon}>✓</span> Mobile money (1.5%)</li>
                <li><span className={styles.checkIcon}>✓</span> Analytiques avancées</li>
                <li><span className={styles.checkIcon}>✓</span> WhatsApp & Instagram</li>
                <li><span className={styles.checkIcon}>✓</span> Support prioritaire</li>
              </ul>
              <Link href="/auth/register" className={`${styles.pricingCta} ${styles.pricingCtaPrimary}`}>
                Commencer l&apos;essai gratuit
              </Link>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.pricingPlan}>Entreprise</div>
              <div className={styles.pricingPrice}>
                <span className={styles.pricingCurrency}>$</span>
                <span className={styles.pricingAmount}>49</span>
                <span className={styles.pricingPeriod}> / mois</span>
              </div>
              <div className={styles.pricingDesc}>Pour les grandes entreprises avec des volumes de vente élevés.</div>
              <ul className={styles.pricingFeatures}>
                <li><span className={styles.checkIcon}>✓</span> Boutiques illimitées</li>
                <li><span className={styles.checkIcon}>✓</span> Produits illimités</li>
                <li><span className={styles.checkIcon}>✓</span> Mobile money (0.8%)</li>
                <li><span className={styles.checkIcon}>✓</span> API complète</li>
                <li><span className={styles.checkIcon}>✓</span> Multi-utilisateurs</li>
                <li><span className={styles.checkIcon}>✓</span> Account manager dédié</li>
              </ul>
              <Link href="/auth/register" className={`${styles.pricingCta} ${styles.pricingCtaOutline}`}>
                Nous contacter
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className={styles.ctaBanner}>
        <h2 className={styles.ctaBannerTitle}>
          Prêt à vendre en ligne ?<br />Créez votre boutique maintenant.
        </h2>
        <p className={styles.ctaBannerDesc}>
          Rejoignez plus de 2 500 commerçants congolais qui font confiance à Commerce Opus pour développer leur activité.
        </p>
        <div className={styles.ctaBannerBtns}>
          <Link href="/auth/register" className={styles.btnWhite}>
            Créer ma boutique gratuitement
          </Link>
          <Link href="/store/demo" className={styles.btnWhiteOutline}>
            Voir une boutique exemple
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div>
              <div className={styles.footerBrand}>
                <span style={{ background: 'linear-gradient(135deg, #3730a3, #22c55e)', width: 28, height: 28, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.9rem' }}>C</span>
                Commerce Opus DRC
              </div>
              <p className={styles.footerBrandDesc}>
                La plateforme e-commerce pour les commerçants de la République Démocratique du Congo.
              </p>
            </div>
            <div>
              <div className={styles.footerColTitle}>Plateforme</div>
              <ul className={styles.footerLinks}>
                <li><a href="#fonctionnalites">Fonctionnalités</a></li>
                <li><a href="#tarifs">Tarifs</a></li>
                <li><Link href="/auth/register">Créer une boutique</Link></li>
                <li><Link href="/auth/login">Se connecter</Link></li>
              </ul>
            </div>
            <div>
              <div className={styles.footerColTitle}>Paiements</div>
              <ul className={styles.footerLinks}>
                <li><a href="#paiements">M-Pesa</a></li>
                <li><a href="#paiements">Orange Money</a></li>
                <li><a href="#paiements">Airtel Money</a></li>
                <li><a href="#paiements">Sécurité</a></li>
              </ul>
            </div>
            <div>
              <div className={styles.footerColTitle}>Support</div>
              <ul className={styles.footerLinks}>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">Contact WhatsApp</a></li>
                <li><a href="#">À propos</a></li>
                <li><a href="#">Confidentialité</a></li>
              </ul>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span className={styles.footerCopy}>© 2024 Commerce Opus DRC. Tous droits réservés.</span>
            <span className={styles.footerDrc}>Fait avec soin pour la RDC</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
