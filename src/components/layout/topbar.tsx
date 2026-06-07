'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Menu, Moon, Sun, LogOut, User as UserIcon, Search, Languages } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet } from './sheet';
import { Sidebar } from './sidebar';
import type { Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';

interface TopbarProps {
  profile: Profile;
}

export function Topbar({ profile }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { t, lang, setLang } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-border/60 bg-card/80 backdrop-blur-lg">
        <div className="h-full px-4 lg:px-8 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden sm:flex flex-1 max-w-md relative">
            <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder={t('topbar.search_placeholder')}
              className="h-10 w-full rounded-lg border border-input bg-background/60 pl-10 pr-4 rtl:pr-10 rtl:pl-4 text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-colors"
            />
          </div>

          <div className="flex-1 sm:hidden" />

          {/* Sélecteur de langue FR / العربية */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('topbar.language')}>
                <Languages className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>{t('topbar.language')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setLang('fr')} className={lang === 'fr' ? 'bg-accent' : ''}>
                🇫🇷 Français
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLang('ar')} className={lang === 'ar' ? 'bg-accent' : ''}>
                🇲🇦 العربية
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Theme"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="h-4 w-4 hidden dark:block" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-2.5 px-2 pr-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start leading-tight">
                  <span className="text-sm font-medium">{profile.full_name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {profile.role === 'super_admin' ? t('topbar.super_admin') : t('topbar.cashier')}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{profile.full_name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                {t('nav.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side={lang === 'ar' ? 'right' : 'left'}>
        <div className="h-full w-72">
          <Sidebar profile={profile} onNavigate={() => setMobileOpen(false)} />
        </div>
      </Sheet>
    </>
  );
}
