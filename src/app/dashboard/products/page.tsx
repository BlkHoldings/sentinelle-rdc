'use client';

import { useState } from 'react';
import styles from '../dashboard.module.css';
import productStyles from './products.module.css';

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  category: string;
  status: 'actif' | 'inactif';
  sold: number;
}

const initialProducts: Product[] = [
  { id: '1', name: 'Robe fleurie', price: 45000, currency: 'CDF', stock: 12, category: 'Vêtements', status: 'actif', sold: 32 },
  { id: '2', name: 'Chaussures cuir', price: 85000, currency: 'CDF', stock: 5, category: 'Chaussures', status: 'actif', sold: 18 },
  { id: '3', name: 'Sac à main', price: 62000, currency: 'CDF', stock: 8, category: 'Accessoires', status: 'actif', sold: 25 },
  { id: '4', name: 'Lunettes soleil', price: 28000, currency: 'CDF', stock: 20, category: 'Accessoires', status: 'actif', sold: 41 },
  { id: '5', name: 'Parfum floral', price: 38000, currency: 'CDF', stock: 0, category: 'Beauté', status: 'inactif', sold: 11 },
  { id: '6', name: 'Chemise homme', price: 32000, currency: 'CDF', stock: 15, category: 'Vêtements', status: 'actif', sold: 9 },
];

function formatPrice(p: number) {
  return p.toLocaleString('fr-CD') + ' CDF';
}

type ModalMode = 'add' | 'edit' | null;

const emptyProduct: Omit<Product, 'id' | 'sold'> = {
  name: '',
  price: 0,
  currency: 'CDF',
  stock: 0,
  category: '',
  status: 'actif',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [search, setSearch] = useState('');

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm(emptyProduct);
    setEditingProduct(null);
    setModalMode('add');
  }

  function openEdit(p: Product) {
    setForm({ name: p.name, price: p.price, currency: p.currency, stock: p.stock, category: p.category, status: p.status });
    setEditingProduct(p);
    setModalMode('edit');
  }

  function closeModal() {
    setModalMode(null);
    setEditingProduct(null);
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === 'price' || name === 'stock' ? Number(value) : value }));
  }

  function handleSave() {
    if (!form.name) return;
    if (modalMode === 'add') {
      const newProduct: Product = {
        ...form,
        id: Date.now().toString(),
        sold: 0,
      };
      setProducts((prev) => [newProduct, ...prev]);
    } else if (modalMode === 'edit' && editingProduct) {
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? { ...p, ...form } : p))
      );
    }
    closeModal();
  }

  function handleDelete(id: string) {
    if (confirm('Supprimer ce produit ?')) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  function toggleStatus(id: string) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: p.status === 'actif' ? 'inactif' : 'actif' } : p
      )
    );
  }

  return (
    <>
      <div className={styles.topbar}>
        <span className={styles.topbarTitle}>Produits</span>
        <div className={styles.topbarActions}>
          <button className={styles.topbarBtnPrimary} onClick={openAdd}>
            + Ajouter un produit
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Search + Filter */}
        <div className={productStyles.toolbar}>
          <input
            type="search"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={productStyles.searchInput}
          />
          <span className={productStyles.count}>{filtered.length} produit(s)</span>
        </div>

        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Prix</th>
                <th>Stock</th>
                <th>Vendus</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyStateIcon}>📦</div>
                      <div className={styles.emptyStateTitle}>Aucun produit trouvé</div>
                      <div className={styles.emptyStateDesc}>Ajoutez votre premier produit pour commencer à vendre.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, color: '#1a1a2e' }}>{p.name}</td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeGray}`}>{p.category}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(p.price)}</td>
                    <td>
                      <span style={{ color: p.stock === 0 ? '#dc2626' : p.stock < 5 ? '#ca8a04' : '#16a34a', fontWeight: 600 }}>
                        {p.stock === 0 ? 'Épuisé' : p.stock}
                      </span>
                    </td>
                    <td>{p.sold}</td>
                    <td>
                      <button
                        onClick={() => toggleStatus(p.id)}
                        className={`${styles.badge} ${p.status === 'actif' ? styles.badgeGreen : styles.badgeGray}`}
                        style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
                      >
                        {p.status === 'actif' ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td>
                      <div className={productStyles.actionBtns}>
                        <button className={productStyles.editBtn} onClick={() => openEdit(p)}>Modifier</button>
                        <button className={productStyles.deleteBtn} onClick={() => handleDelete(p.id)}>Supprimer</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {modalMode && (
        <div className={productStyles.modalOverlay} onClick={closeModal}>
          <div className={productStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={productStyles.modalHeader}>
              <h2 className={productStyles.modalTitle}>
                {modalMode === 'add' ? 'Nouveau produit' : 'Modifier le produit'}
              </h2>
              <button className={productStyles.modalClose} onClick={closeModal}>✕</button>
            </div>
            <div className={productStyles.modalBody}>
              <div className={productStyles.fieldGroup}>
                <label className={productStyles.label}>Nom du produit *</label>
                <input name="name" value={form.name} onChange={handleFormChange} className={productStyles.input} placeholder="Ex: Robe fleurie" />
              </div>
              <div className={productStyles.formRow}>
                <div className={productStyles.fieldGroup}>
                  <label className={productStyles.label}>Prix</label>
                  <input name="price" type="number" min={0} value={form.price} onChange={handleFormChange} className={productStyles.input} />
                </div>
                <div className={productStyles.fieldGroup}>
                  <label className={productStyles.label}>Devise</label>
                  <select name="currency" value={form.currency} onChange={handleFormChange} className={productStyles.input}>
                    <option value="CDF">CDF</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className={productStyles.formRow}>
                <div className={productStyles.fieldGroup}>
                  <label className={productStyles.label}>Stock</label>
                  <input name="stock" type="number" min={0} value={form.stock} onChange={handleFormChange} className={productStyles.input} />
                </div>
                <div className={productStyles.fieldGroup}>
                  <label className={productStyles.label}>Catégorie</label>
                  <input name="category" value={form.category} onChange={handleFormChange} className={productStyles.input} placeholder="Ex: Vêtements" />
                </div>
              </div>
              <div className={productStyles.fieldGroup}>
                <label className={productStyles.label}>Statut</label>
                <select name="status" value={form.status} onChange={handleFormChange} className={productStyles.input}>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                </select>
              </div>
            </div>
            <div className={productStyles.modalFooter}>
              <button className={productStyles.cancelBtn} onClick={closeModal}>Annuler</button>
              <button className={productStyles.saveBtn} onClick={handleSave}>
                {modalMode === 'add' ? 'Ajouter le produit' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
