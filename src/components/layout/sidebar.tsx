'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  Users,
  Truck,
  Receipt,
  Wallet,
  FileCheck2,
  BarChart3,
  Settings,
  ArrowRightLeft,
  UserCog,
  Scissors,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Profile } from '@/types/database';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translations';

import type { LucideIcon } from 'lucide-react';

type NavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  roles?: ('super_admin' | 'caissier')[];
  badge?: string;
};

const NAV_GROUPS: { titleKey: TranslationKey; items: NavItem[] }[] = [
  {
    titleKey: 'nav.pilotage',
    items: [
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['super_admin'] },
      { href: '/pos', labelKey: 'nav.new_order', icon: ShoppingCart, badge: 'POS' },
    ],
  },
  {
    titleKey: 'nav.stock',
    items: [
      { href: '/products', labelKey: 'nav.articles', icon: Package },
      { href: '/stock-add', labelKey: 'nav.stock_add', icon: Layers },
      { href: '/stock', labelKey: 'nav.stock_view', icon: Package },
    ],
  },
  {
    titleKey: 'nav.relations',
    items: [
      { href: '/clients', labelKey: 'nav.clients', icon: Users, roles: ['super_admin'] },
      { href: '/suppliers', labelKey: 'nav.suppliers', icon: Truck, roles: ['super_admin'] },
    ],
  },
  {
    titleKey: 'nav.finance',
    items: [
      { href: '/checks', labelKey: 'nav.checks', icon: FileCheck2, roles: ['super_admin'] },
      { href: '/reports', labelKey: 'nav.reports', icon: BarChart3, roles: ['super_admin', 'caissier'] },
    ],
  },
  {
    titleKey: 'nav.administration',
    items: [
      { href: '/users', labelKey: 'nav.users', icon: UserCog, roles: ['super_admin'] },
      { href: '/settings', labelKey: 'nav.settings', icon: Settings, roles: ['super_admin'] },
    ],
  },
];

interface SidebarProps {
  profile: Profile;
  onNavigate?: () => void;
}

export function Sidebar({ profile, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  const isActive = (href: string) => {
    // Correspondance exacte pour éviter que /stock-add active aussi /stock
    if (pathname === href) return true;
    // Sous-routes : actif seulement si le segment suivant est un "/"
    // (ex: /clients/123 active /clients, mais /stock-add n'active pas /stock)
    return pathname.startsWith(href + '/');
  };

  return (
    <aside className="flex h-full flex-col bg-card border-r border-border/60">
      {/* Brand */}
      <div className="px-5 h-16 flex items-center gap-2.5 border-b border-border/60">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
          <Scissors className="h-4.5 w-4.5" strokeWidth={2.2} />
        </div>
        <div className="leading-none">
          <div className="font-semibold tracking-tight">TextilePOS</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            Pro Edition
          </div>
        </div>
      </div>

      {/* Magasin badge */}
      <div className="px-4 py-3 border-b border-border/60">
        <div className="rounded-xl bg-muted/50 px-3 py-2.5 flex items-center gap-3">
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-success" />
            <div className="absolute inset-0 rounded-full bg-success animate-pulse-ring" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {profile.role === 'super_admin' ? t('topbar.super_admin') : t('topbar.cashier')}
            </div>
            <div className="text-sm font-medium truncate">
              {profile.role === 'super_admin' ? t('nav.all_stores') : profile.store?.name ?? '—'}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <nav className="px-3 py-4 space-y-6">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(
              (i) => !i.roles || i.roles.includes(profile.role)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.titleKey}>
                <div className="px-2.5 mb-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/70">
                  {t(group.titleKey)}
                </div>
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          className={cn(
                            'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all',
                            'hover:bg-accent/60',
                            active
                              ? 'bg-foreground text-background shadow-sm hover:bg-foreground'
                              : 'text-foreground/70 hover:text-foreground'
                          )}
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-colors',
                              active
                                ? 'text-background'
                                : 'text-muted-foreground group-hover:text-foreground'
                            )}
                            strokeWidth={active ? 2.2 : 1.8}
                          />
                          <span className="flex-1">{t(item.labelKey)}</span>
                          {item.badge && (
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                                active
                                  ? 'bg-background/20 text-background'
                                  : 'bg-primary/10 text-primary'
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="px-4 py-3 border-t border-border/60 text-[10px] text-muted-foreground">
        TextilePOS v1.0 · © {new Date().getFullYear()}
      </div>
    </aside>
  );
}
