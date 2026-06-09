'use client';

import { useState } from 'react';
import { use } from 'react';
import styles from '../store.module.css';
import ProductCard, { Product } from '@/components/commerce/ProductCard';
import CartDrawer, { CartItem } from '@/components/commerce/CartDrawer';

// Demo store data — in production this would come from a database
const STORES: Record<string, {
  name: string;
  description: string;
  phone: string;
  city: string;
  logo: string;
  themeColor: string;
  instagram?: string;
  products: Product[];
}> = {
  'ma-boutique-kinshasa': {
    name: 'Ma Boutique Kinshasa',
    description: 'Vêtements et accessoires de mode pour femmes et hommes à Kinshasa. Livraison rapide dans toute la ville.',
    phone: '+243812345678',
    city: 'Kinshasa, RDC',
    logo: 'MBK',
    themeColor: '#3730a3',
    instagram: '@maboutique_kin',
    products: [
      { id: '1', name: 'Robe fleurie', price: 45000, currency: 'CDF', category: 'Vêtements', stock: 12, emoji: '👗' },
      { id: '2', name: 'Chaussures cuir homme', price: 85000, currency: 'CDF', category: 'Chaussures', stock: 5, emoji: '👞' },
      { id: '3', name: 'Sac à main élégant', price: 62000, currency: 'CDF', category: 'Accessoires', stock: 8, emoji: '👜' },
      { id: '4', name: 'Lunettes de soleil', price: 28000, currency: 'CDF', category: 'Accessoires', stock: 20, emoji: '🕶️' },
      { id: '5', name: 'Parfum floral', price: 38000, currency: 'CDF', category: 'Beauté', stock: 0, emoji: '🌸' },
      { id: '6', name: 'Chemise homme', price: 32000, currency: 'CDF', category: 'Vêtements', stock: 15, emoji: '👔' },
      { id: '7', name: 'Bracelet argent', price: 18000, currency: 'CDF', category: 'Bijoux', stock: 30, emoji: '💎' },
      { id: '8', name: 'Écharpe africaine', price: 22000, currency: 'CDF', category: 'Accessoires', stock: 10, emoji: '🧣' },
    ],
  },
  demo: {
    name: 'Boutique Démo',
    description: 'Ceci est une boutique de démonstration de Commerce Opus DRC.',
    phone: '+243800000000',
    city: 'Kinshasa, RDC',
    logo: 'DEMO',
    themeColor: '#16a34a',
    products: [
      { id: '1', name: 'Produit exemple 1', price: 15000, currency: 'CDF', category: 'Exemple', stock: 10, emoji: '🎁' },
      { id: '2', name: 'Produit exemple 2', price: 25000, currency: 'CDF', category: 'Exemple', stock: 5, emoji: '🎀' },
      { id: '3', name: 'Produit exemple 3', price: 35000, currency: 'CDF', category: 'Exemple', stock: 8, emoji: '✨' },
    ],
  },
};

const ALL_CATEGORIES = 'Tous';

export default function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const store = STORES[slug] || STORES['demo'];

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [search, setSearch] = useState('');

  const categories = [ALL_CATEGORIES, ...Array.from(new Set(store.products.map((p) => p.category)))];

  const filtered = store.products.filter((p) => {
    const matchCat = activeCategory === ALL_CATEGORIES || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === productId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter((i) => i.product.id !== productId);
      return prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  }

  function clearItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  function getQuantity(productId: string) {
    return cart.find((i) => i.product.id === productId)?.quantity || 0;
  }

  const whatsappMsg = encodeURIComponent(
    `Bonjour ! Je suis intéressé(e) par vos produits sur ${store.name}. Pouvez-vous m'aider ?`
  );

  return (
    <div className={styles.page}>
      {/* Store header */}
      <header className={styles.storeHeader} style={{ background: `linear-gradient(135deg, ${store.themeColor}, ${store.themeColor}cc)` }}>
        <div className={styles.storeHeaderInner}>
          <div className={styles.storeLogo}>{store.logo}</div>
          <div className={styles.storeInfo}>
            <h1 className={styles.storeName}>{store.name}</h1>
            <p className={styles.storeDesc}>{store.description}</p>
            <div className={styles.storeMeta}>
              <span className={styles.storeBadge}>📍 {store.city}</span>
              <span className={styles.storeBadge}>{store.products.length} produits</span>
              {store.instagram && (
                <span className={styles.storeBadge}>{store.instagram}</span>
              )}
            </div>
          </div>
          <div className={styles.storeActions}>
            <a
              href={`https://wa.me/${store.phone.replace(/\D/g, '')}?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappBtn}
            >
              WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* Sticky nav */}
      <nav className={styles.storeNav}>
        <div className={styles.storeNavInner}>
          <div className={styles.storeNavCategories}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`${styles.categoryTab} ${activeCategory === cat ? styles.categoryTabActive : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className={styles.cartBtnWrapper}>
            <button className={styles.cartBtn} onClick={() => setCartOpen(true)} aria-label="Ouvrir le panier">
              🛒 Panier
            </button>
            {totalItems > 0 && (
              <span className={styles.cartCount} aria-live="polite">{totalItems}</span>
            )}
          </div>
        </div>
      </nav>

      {/* Products */}
      <main className={styles.mainContent}>
        <div className={styles.searchBar}>
          <input
            type="search"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            aria-label="Rechercher"
          />
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
            <div style={{ fontWeight: 700, color: '#374151', marginBottom: '0.4rem' }}>Aucun produit trouvé</div>
            <div>Essayez une autre recherche ou catégorie.</div>
          </div>
        ) : (
          <div className={styles.productsGrid}>
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={getQuantity(product.id)}
                onAdd={addToCart}
                onRemove={removeFromCart}
              />
            ))}
          </div>
        )}
      </main>

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          items={cart}
          storeSlug={slug}
          onClose={() => setCartOpen(false)}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onClearItem={clearItem}
        />
      )}
    </div>
  );
}
