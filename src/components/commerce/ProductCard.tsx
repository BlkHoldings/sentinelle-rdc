'use client';

import styles from './ProductCard.module.css';

export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  category: string;
  stock: number;
  emoji?: string;
}

interface ProductCardProps {
  product: Product;
  quantity: number;
  onAdd: (product: Product) => void;
  onRemove: (productId: string) => void;
}

function formatPrice(price: number, currency: string) {
  return price.toLocaleString('fr-CD') + ' ' + currency;
}

export default function ProductCard({ product, quantity, onAdd, onRemove }: ProductCardProps) {
  const outOfStock = product.stock === 0;

  return (
    <div className={styles.card}>
      <div className={styles.imageWrapper}>
        <div className={styles.imagePlaceholder}>
          {product.emoji || '🛍️'}
        </div>
        {outOfStock && <span className={styles.outOfStockBadge}>Épuisé</span>}
      </div>
      <div className={styles.body}>
        <div className={styles.category}>{product.category}</div>
        <div className={styles.name}>{product.name}</div>
        <div className={styles.footer}>
          <span className={styles.price}>{formatPrice(product.price, product.currency)}</span>
          {quantity === 0 ? (
            <button
              className={styles.addBtn}
              onClick={() => onAdd(product)}
              disabled={outOfStock}
              aria-label={`Ajouter ${product.name} au panier`}
            >
              +
            </button>
          ) : (
            <div className={styles.qtyControl}>
              <button
                className={styles.qtyBtn}
                onClick={() => onRemove(product.id)}
                aria-label="Retirer un article"
              >
                −
              </button>
              <span className={styles.qtyNum}>{quantity}</span>
              <button
                className={`${styles.addBtn} ${styles.addedBtn}`}
                onClick={() => onAdd(product)}
                disabled={outOfStock || quantity >= product.stock}
                aria-label="Ajouter un article"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
