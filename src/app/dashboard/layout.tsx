'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './dashboard.module.css';

const navItems = [
  { href: '/dashboard', icon: '📊', label: 'Tableau de bord', section: 'principal' },
  { href: '/dashboard/orders', icon: '📦', label: 'Commandes', section: 'principal' },
  { href: '/dashboard/products', icon: '🛍️', label: 'Produits', section: 'principal' },
  { href: '/dashboard/analytics', icon: '📈', label: 'Analytiques', section: 'principal' },
  { href: '/dashboard/payments', icon: '💳', label: 'Paiements', section: 'parametres' },
  { href: '/dashboard/store', icon: '🏪', label: 'Ma Boutique', section: 'parametres' },
];

const sections = ['principal', 'parametres'] as const;
const sectionLabels: Record<string, string> = {
  principal: 'Principal',
  parametres: 'Paramètres',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <div className={styles.shell}>
      {/* SIDEBAR */}
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.sidebarLogo}>
          <span className={styles.sidebarLogoIcon}>C</span>
          Commerce Opus
        </Link>

        {sections.map((section) => {
          const items = navItems.filter((i) => i.section === section);
          return (
            <div key={section} className={styles.sidebarSection}>
              <div className={styles.sidebarSectionLabel}>{sectionLabels[section]}</div>
              <ul className={styles.sidebarNav}>
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`${styles.sidebarLink} ${isActive(item.href) ? styles.sidebarLinkActive : ''}`}
                    >
                      <span className={styles.sidebarIcon}>{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div className={styles.sidebarBottom}>
          <div className={styles.demoBadge}>MODE DÉMO</div>
          <div className={styles.sidebarUser}>
            <div className={styles.sidebarAvatar}>JK</div>
            <div className={styles.sidebarUserInfo}>
              <div className={styles.sidebarUserName}>Jean Kabila</div>
              <div className={styles.sidebarUserStore}>Ma Boutique Kinshasa</div>
            </div>
          </div>
          <Link href="/" className={styles.logoutLink}>← Retour au site</Link>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className={styles.main}>
        {children}
      </div>
    </div>
  );
}
