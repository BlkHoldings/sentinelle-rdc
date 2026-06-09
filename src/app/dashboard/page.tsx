import Link from 'next/link';
import styles from './dashboard.module.css';

const stats = [
  { label: 'Revenus ce mois', value: '1 245 000 CDF', change: '+18.2%', positive: true },
  { label: 'Commandes', value: '87', change: '+12.5%', positive: true },
  { label: 'Produits actifs', value: '34', change: '+5', positive: true },
  { label: 'Clients', value: '213', change: '+23.1%', positive: true },
];

const recentOrders = [
  { id: '#CMD-001', customer: 'Marie Mbuyi', product: 'Robe fleurie', amount: '45 000 CDF', status: 'Livré', method: 'M-Pesa', date: '09/06/2024' },
  { id: '#CMD-002', customer: 'Paul Ngoy', product: 'Chaussures cuir', amount: '85 000 CDF', status: 'En cours', method: 'Orange Money', date: '09/06/2024' },
  { id: '#CMD-003', customer: 'Cécile Tshisekedi', product: 'Sac à main', amount: '62 000 CDF', status: 'En attente', method: 'Airtel Money', date: '08/06/2024' },
  { id: '#CMD-004', customer: 'Roger Kasongo', product: 'Lunettes soleil', amount: '28 000 CDF', status: 'Livré', method: 'M-Pesa', date: '08/06/2024' },
  { id: '#CMD-005', customer: 'Diane Lumbu', product: 'Parfum', amount: '38 000 CDF', status: 'Annulé', method: 'Orange Money', date: '07/06/2024' },
];

const statusMap: Record<string, string> = {
  'Livré': styles.badgeGreen,
  'En cours': styles.badgeBlue,
  'En attente': styles.badgeYellow,
  'Annulé': styles.badgeRed,
};

const topProducts = [
  { name: 'Robe fleurie', sold: 32, revenue: '1 440 000 CDF' },
  { name: 'Chaussures cuir', sold: 18, revenue: '1 530 000 CDF' },
  { name: 'Sac à main', sold: 25, revenue: '1 550 000 CDF' },
  { name: 'Lunettes soleil', sold: 41, revenue: '1 148 000 CDF' },
];

export default function DashboardPage() {
  return (
    <>
      <div style={{
        background: 'linear-gradient(90deg, #3730a3, #4f46e5)',
        color: 'white',
        padding: '0.55rem 1.75rem',
        fontSize: '0.8rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '0.1rem 0.45rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em' }}>DÉMO</span>
        Vous explorez un tableau de bord de démonstration — toutes les données sont fictives.
        <a href="/auth/register" style={{ marginLeft: 'auto', color: '#86efac', fontWeight: 700, textDecoration: 'none' }}>Créer un vrai compte →</a>
      </div>
      <div className={styles.topbar}>
        <span className={styles.topbarTitle}>Tableau de bord</span>
        <div className={styles.topbarActions}>
          <Link href="/store/ma-boutique-kinshasa" className={styles.topbarBtnPrimary}>
            Voir ma boutique
          </Link>
        </div>
      </div>

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsGrid}>
          {stats.map((s) => (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statCardLabel}>{s.label}</div>
              <div className={styles.statCardValue}>{s.value}</div>
              <div className={`${styles.statCardChange} ${s.positive ? styles.changePositive : styles.changeNegative}`}>
                {s.positive ? '↑' : '↓'} {s.change} ce mois
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Recent orders */}
          <div className={styles.tableCard} style={{ gridColumn: '1 / -1' }}>
            <div className={styles.tableCardHeader}>
              <span className={styles.tableCardTitle}>Dernières commandes</span>
              <Link href="/dashboard/orders" className={styles.tableCardAction}>Voir tout</Link>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Commande</th>
                  <th>Client</th>
                  <th>Produit</th>
                  <th>Montant</th>
                  <th>Méthode</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 700, color: '#3730a3' }}>{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{order.product}</td>
                    <td style={{ fontWeight: 600 }}>{order.amount}</td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeGray}`}>{order.method}</span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${statusMap[order.status] || styles.badgeGray}`}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ color: '#9ca3af' }}>{order.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top products */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <span className={styles.tableCardTitle}>Meilleurs produits</span>
              <Link href="/dashboard/products" className={styles.tableCardAction}>Gérer</Link>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Vendus</th>
                  <th>Revenus</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.name}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.sold}</td>
                    <td style={{ fontWeight: 600, color: '#16a34a' }}>{p.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick links */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Actions rapides</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link
                href="/dashboard/products"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f8f7ff', borderRadius: 8, textDecoration: 'none', color: '#1a1a2e', fontWeight: 600, fontSize: '0.875rem' }}
              >
                <span>🛍️</span> Ajouter un produit
              </Link>
              <Link
                href="/dashboard/payments"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f8f7ff', borderRadius: 8, textDecoration: 'none', color: '#1a1a2e', fontWeight: 600, fontSize: '0.875rem' }}
              >
                <span>💳</span> Configurer les paiements
              </Link>
              <Link
                href="/dashboard/store"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f8f7ff', borderRadius: 8, textDecoration: 'none', color: '#1a1a2e', fontWeight: 600, fontSize: '0.875rem' }}
              >
                <span>🏪</span> Personnaliser ma boutique
              </Link>
              <a
                href="https://wa.me/?text=Découvrez%20ma%20boutique%20en%20ligne%20!"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f0fdf4', borderRadius: 8, textDecoration: 'none', color: '#16a34a', fontWeight: 600, fontSize: '0.875rem' }}
              >
                <span>📱</span> Partager sur WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
