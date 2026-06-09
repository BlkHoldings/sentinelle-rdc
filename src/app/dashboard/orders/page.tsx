'use client';

import { useState } from 'react';
import styles from '../dashboard.module.css';
import orderStyles from './orders.module.css';

interface Order {
  id: string;
  customer: string;
  phone: string;
  products: string;
  amount: number;
  currency: string;
  method: string;
  status: OrderStatus;
  date: string;
  address: string;
}

type OrderStatus = 'en_attente' | 'confirme' | 'en_cours' | 'livre' | 'annule';

const STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  confirme: 'Confirmé',
  en_cours: 'En cours',
  livre: 'Livré',
  annule: 'Annulé',
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  en_attente: styles.badgeYellow,
  confirme: styles.badgeBlue,
  en_cours: styles.badgeBlue,
  livre: styles.badgeGreen,
  annule: styles.badgeRed,
};

const ORDERS: Order[] = [
  { id: 'CMD-001', customer: 'Marie Mbuyi', phone: '+243 81 234 5678', products: 'Robe fleurie × 1', amount: 45000, currency: 'CDF', method: 'M-Pesa', status: 'livre', date: '09/06/2024', address: 'Gombe, Kinshasa' },
  { id: 'CMD-002', customer: 'Paul Ngoy', phone: '+243 97 567 8901', products: 'Chaussures cuir × 1', amount: 85000, currency: 'CDF', method: 'Orange Money', status: 'en_cours', date: '09/06/2024', address: 'Lingwala, Kinshasa' },
  { id: 'CMD-003', customer: 'Cécile Tshisekedi', phone: '+243 82 345 6789', products: 'Sac à main × 1', amount: 62000, currency: 'CDF', method: 'Airtel Money', status: 'en_attente', date: '08/06/2024', address: 'Barumbu, Kinshasa' },
  { id: 'CMD-004', customer: 'Roger Kasongo', phone: '+243 80 123 4567', products: 'Lunettes soleil × 2', amount: 56000, currency: 'CDF', method: 'M-Pesa', status: 'livre', date: '08/06/2024', address: 'Kalamu, Kinshasa' },
  { id: 'CMD-005', customer: 'Diane Lumbu', phone: '+243 99 876 5432', products: 'Parfum floral × 1', amount: 38000, currency: 'CDF', method: 'Orange Money', status: 'annule', date: '07/06/2024', address: 'Ngaba, Kinshasa' },
  { id: 'CMD-006', customer: 'Eric Mukendi', phone: '+243 81 654 3210', products: 'Chemise homme × 2', amount: 64000, currency: 'CDF', method: 'Airtel Money', status: 'confirme', date: '07/06/2024', address: 'Ngaliema, Kinshasa' },
  { id: 'CMD-007', customer: 'Sophie Mbala', phone: '+243 84 321 0987', products: 'Robe fleurie × 1, Sac à main × 1', amount: 107000, currency: 'CDF', method: 'M-Pesa', status: 'livre', date: '06/06/2024', address: 'Kintambo, Kinshasa' },
];

function formatPrice(amount: number, currency: string) {
  return amount.toLocaleString('fr-CD') + ' ' + currency;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(ORDERS);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'tous'>('tous');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const filtered = orders.filter((o) =>
    filterStatus === 'tous' ? true : o.status === filterStatus
  );

  function updateStatus(id: string, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    if (selectedOrder?.id === id) {
      setSelectedOrder((prev) => (prev ? { ...prev, status } : prev));
    }
  }

  return (
    <>
      <div className={styles.topbar}>
        <span className={styles.topbarTitle}>Commandes</span>
        <div className={styles.topbarActions}>
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            {orders.length} commande(s) au total
          </span>
        </div>
      </div>

      <div className={styles.content}>
        {/* Filter tabs */}
        <div className={orderStyles.filterTabs}>
          {(['tous', 'en_attente', 'confirme', 'en_cours', 'livre', 'annule'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`${orderStyles.filterTab} ${filterStatus === s ? orderStyles.filterTabActive : ''}`}
            >
              {s === 'tous' ? 'Toutes' : STATUS_LABELS[s as OrderStatus]}
              <span className={orderStyles.filterCount}>
                {s === 'tous' ? orders.length : orders.filter((o) => o.status === s).length}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1fr 340px' : '1fr', gap: '1.5rem' }}>
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Commande</th>
                  <th>Client</th>
                  <th>Produits</th>
                  <th>Montant</th>
                  <th>Méthode</th>
                  <th>Statut</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyStateIcon}>📦</div>
                        <div className={styles.emptyStateTitle}>Aucune commande</div>
                        <div className={styles.emptyStateDesc}>Les commandes de vos clients apparaîtront ici.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 700, color: '#3730a3' }}>#{order.id}</td>
                      <td style={{ fontWeight: 600 }}>{order.customer}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.products}</td>
                      <td style={{ fontWeight: 600 }}>{formatPrice(order.amount, order.currency)}</td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeGray}`}>{order.method}</span>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${STATUS_STYLE[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td style={{ color: '#9ca3af' }}>{order.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Order detail panel */}
          {selectedOrder && (
            <div className={orderStyles.detailPanel}>
              <div className={orderStyles.detailHeader}>
                <span className={orderStyles.detailId}>#{selectedOrder.id}</span>
                <button className={orderStyles.detailClose} onClick={() => setSelectedOrder(null)}>✕</button>
              </div>
              <div className={orderStyles.detailBody}>
                <div className={orderStyles.detailSection}>
                  <div className={orderStyles.detailLabel}>Client</div>
                  <div className={orderStyles.detailValue}>{selectedOrder.customer}</div>
                  <div className={orderStyles.detailSub}>{selectedOrder.phone}</div>
                </div>
                <div className={orderStyles.detailSection}>
                  <div className={orderStyles.detailLabel}>Adresse de livraison</div>
                  <div className={orderStyles.detailValue}>{selectedOrder.address}</div>
                </div>
                <div className={orderStyles.detailSection}>
                  <div className={orderStyles.detailLabel}>Produits</div>
                  <div className={orderStyles.detailValue}>{selectedOrder.products}</div>
                </div>
                <div className={orderStyles.detailSection}>
                  <div className={orderStyles.detailLabel}>Paiement</div>
                  <div className={orderStyles.detailValue}>{formatPrice(selectedOrder.amount, selectedOrder.currency)}</div>
                  <div className={orderStyles.detailSub}>via {selectedOrder.method}</div>
                </div>
                <div className={orderStyles.detailSection}>
                  <div className={orderStyles.detailLabel}>Statut actuel</div>
                  <span className={`${styles.badge} ${STATUS_STYLE[selectedOrder.status]}`}>
                    {STATUS_LABELS[selectedOrder.status]}
                  </span>
                </div>
                <div className={orderStyles.detailSection}>
                  <div className={orderStyles.detailLabel}>Changer le statut</div>
                  <div className={orderStyles.statusBtns}>
                    {(['confirme', 'en_cours', 'livre', 'annule'] as OrderStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedOrder.id, s)}
                        className={`${orderStyles.statusBtn} ${selectedOrder.status === s ? orderStyles.statusBtnActive : ''}`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <a
                  href={`https://wa.me/${selectedOrder.phone.replace(/\D/g, '')}?text=Bonjour%20${encodeURIComponent(selectedOrder.customer)},%20votre%20commande%20${selectedOrder.id}%20est%20${encodeURIComponent(STATUS_LABELS[selectedOrder.status])}.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={orderStyles.whatsappBtn}
                >
                  Notifier via WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
