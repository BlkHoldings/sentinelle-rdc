import styles from '../dashboard.module.css';
import analyticsStyles from './analytics.module.css';

const monthlyData = [
  { month: 'Jan', revenue: 480000, orders: 28 },
  { month: 'Fév', revenue: 620000, orders: 37 },
  { month: 'Mar', revenue: 540000, orders: 32 },
  { month: 'Avr', revenue: 780000, orders: 51 },
  { month: 'Mai', revenue: 920000, orders: 63 },
  { month: 'Jun', revenue: 1245000, orders: 87 },
];

const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue));
const maxOrders = Math.max(...monthlyData.map((d) => d.orders));

const paymentMethodStats = [
  { method: 'M-Pesa', pct: 48, amount: '598 000 CDF', color: '#E11D48' },
  { method: 'Orange Money', pct: 31, amount: '386 000 CDF', color: '#F97316' },
  { method: 'Airtel Money', pct: 21, amount: '261 000 CDF', color: '#DC2626' },
];

const topCategories = [
  { name: 'Vêtements', pct: 42, orders: 37 },
  { name: 'Accessoires', pct: 28, orders: 24 },
  { name: 'Chaussures', pct: 18, orders: 16 },
  { name: 'Beauté', pct: 12, orders: 10 },
];

const topCities = [
  { city: 'Kinshasa', pct: 61, orders: 53 },
  { city: 'Lubumbashi', pct: 19, orders: 17 },
  { city: 'Goma', pct: 11, orders: 10 },
  { city: 'Bukavu', pct: 9, orders: 7 },
];

export default function AnalyticsPage() {
  return (
    <>
      <div className={styles.topbar}>
        <span className={styles.topbarTitle}>Analytiques</span>
        <div className={styles.topbarActions}>
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Données : Janvier – Juin 2024</span>
        </div>
      </div>

      <div className={styles.content}>
        {/* KPI Row */}
        <div className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className={styles.statCard}>
            <div className={styles.statCardLabel}>Revenus totaux</div>
            <div className={styles.statCardValue}>4 585 000</div>
            <div className={`${styles.statCardChange} ${styles.changePositive}`}>CDF · ↑ 32% vs S1 2023</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statCardLabel}>Commandes</div>
            <div className={styles.statCardValue}>298</div>
            <div className={`${styles.statCardChange} ${styles.changePositive}`}>↑ 27% vs S1 2023</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statCardLabel}>Panier moyen</div>
            <div className={styles.statCardValue}>15 385</div>
            <div className={`${styles.statCardChange} ${styles.changePositive}`}>CDF · ↑ 4.2%</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statCardLabel}>Clients actifs</div>
            <div className={styles.statCardValue}>213</div>
            <div className={`${styles.statCardChange} ${styles.changePositive}`}>↑ 23.1% ce mois</div>
          </div>
        </div>

        {/* Revenue Bar Chart */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Revenus mensuels (CDF)</div>
          <div className={analyticsStyles.barChart}>
            {monthlyData.map((d) => {
              const pct = Math.round((d.revenue / maxRevenue) * 100);
              return (
                <div key={d.month} className={analyticsStyles.barGroup}>
                  <div className={analyticsStyles.barWrapper}>
                    <span className={analyticsStyles.barValue}>{(d.revenue / 1000).toFixed(0)}k</span>
                    <div
                      className={analyticsStyles.bar}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className={analyticsStyles.barLabel}>{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Payment methods */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Méthodes de paiement</div>
            <div className={analyticsStyles.donutContainer}>
              {/* Simple bar representation */}
              {paymentMethodStats.map((s) => (
                <div key={s.method} className={analyticsStyles.methodRow}>
                  <div className={analyticsStyles.methodInfo}>
                    <span className={analyticsStyles.methodDot} style={{ background: s.color }} />
                    <span className={analyticsStyles.methodName}>{s.method}</span>
                    <span className={analyticsStyles.methodAmount}>{s.amount}</span>
                  </div>
                  <div className={analyticsStyles.methodBarTrack}>
                    <div
                      className={analyticsStyles.methodBar}
                      style={{ width: `${s.pct}%`, background: s.color }}
                    />
                  </div>
                  <span className={analyticsStyles.methodPct}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Orders per month */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Commandes par mois</div>
            <div className={analyticsStyles.barChart}>
              {monthlyData.map((d) => {
                const pct = Math.round((d.orders / maxOrders) * 100);
                return (
                  <div key={d.month} className={analyticsStyles.barGroup}>
                    <div className={analyticsStyles.barWrapper}>
                      <span className={analyticsStyles.barValue}>{d.orders}</span>
                      <div
                        className={analyticsStyles.bar}
                        style={{ height: `${pct}%`, background: 'linear-gradient(to top, #16a34a, #22c55e)' }}
                      />
                    </div>
                    <span className={analyticsStyles.barLabel}>{d.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top categories */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Catégories les plus vendues</div>
            <div className={analyticsStyles.rankList}>
              {topCategories.map((c, i) => (
                <div key={c.name} className={analyticsStyles.rankItem}>
                  <span className={analyticsStyles.rankNum}>{i + 1}</span>
                  <span className={analyticsStyles.rankName}>{c.name}</span>
                  <div className={analyticsStyles.rankBarTrack}>
                    <div className={analyticsStyles.rankBar} style={{ width: `${c.pct}%` }} />
                  </div>
                  <span className={analyticsStyles.rankPct}>{c.orders} cmd</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top cities */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Ventes par ville</div>
            <div className={analyticsStyles.rankList}>
              {topCities.map((c, i) => (
                <div key={c.city} className={analyticsStyles.rankItem}>
                  <span className={analyticsStyles.rankNum}>{i + 1}</span>
                  <span className={analyticsStyles.rankName}>{c.city}</span>
                  <div className={analyticsStyles.rankBarTrack}>
                    <div
                      className={analyticsStyles.rankBar}
                      style={{ width: `${c.pct}%`, background: 'linear-gradient(to right, #3730a3, #6366f1)' }}
                    />
                  </div>
                  <span className={analyticsStyles.rankPct}>{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
