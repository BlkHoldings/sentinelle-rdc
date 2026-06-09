'use client';

import Link from 'next/link';
import styles from './CartDrawer.module.css';
import type { Product } from './ProductCard';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartDrawerProps {
  items: CartItem[];
  storeSlug: string;
  onClose: () => void;
  onAdd: (product: Product) => void;
  onRemove: (productId: string) => void;
  onClearItem: (productId: string) => void;
}

function formatPrice(price: number, currency: string) {
  return price.toLocaleString('fr-CD') + ' ' + currency;
}

export default function CartDrawer({
  items,
  storeSlug,
  onClose,
  onAdd,
  onRemove,
  onClearItem,
}: CartDrawerProps) {
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const currency = items[0]?.product.currency || 'CDF';
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <aside className={styles.drawer} aria-label="Panier">
        <div className={styles.header}>
          <h2 className={styles.title}>
            Mon panier
            {totalItems > 0 && <span className={styles.count}>{totalItems}</span>}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer le panier">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {items.length === 0 ? (
            <div className={styles.emptyCart}>
              <span className={styles.emptyIcon}>🛒</span>
              <span className={styles.emptyTitle}>Votre panier est vide</span>
              <span className={styles.emptyDesc}>Ajoutez des produits pour commencer vos achats.</span>
            </div>
          ) : (
            items.map(({ product, quantity }) => (
              <div key={product.id} className={styles.cartItem}>
                <div className={styles.cartItemEmoji}>{product.emoji || '🛍️'}</div>
                <div className={styles.cartItemInfo}>
                  <div className={styles.cartItemName}>{product.name}</div>
                  <div className={styles.cartItemPrice}>
                    {formatPrice(product.price * quantity, currency)}
                  </div>
                </div>
                <div className={styles.cartItemQty}>
                  <button
                    className={styles.qtyBtn}
                    onClick={() => onRemove(product.id)}
                    aria-label="Retirer un"
                  >
                    −
                  </button>
                  <span className={styles.qtyNum}>{quantity}</span>
                  <button
                    className={styles.qtyBtn}
                    onClick={() => onAdd(product)}
                    disabled={quantity >= product.stock}
                    aria-label="Ajouter un"
                  >
                    +
                  </button>
                </div>
                <button
                  className={styles.removeBtn}
                  onClick={() => onClearItem(product.id)}
                  aria-label={`Supprimer ${product.name}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.subtotalRow}>
              <span>Sous-total ({totalItems} article{totalItems > 1 ? 's' : ''})</span>
              <span>{formatPrice(subtotal, currency)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Total</span>
              <span>{formatPrice(subtotal, currency)}</span>
            </div>
            <Link
              href={`/store/${storeSlug}/checkout`}
              className={styles.checkoutBtn}
              onClick={onClose}
            >
              Passer la commande
            </Link>
            <button className={styles.continueBtn} onClick={onClose}>
              Continuer vos achats
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
