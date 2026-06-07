'use client';

import { Scissors, TrendingUp, Boxes, Zap } from 'lucide-react';
import { LoginForm } from './login-form';
import { I18nProvider, useI18n } from '@/lib/i18n/context';

function LoginContent() {
  const { t } = useI18n();
  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* ===== Panneau de marque (navy, façon Notion hero) ===== */}
      <div className="relative hidden lg:flex lg:w-[52%] flex-col justify-between p-12 xl:p-16 overflow-hidden bg-[hsl(222,65%,11%)] text-white">
        {/* Dégradé mesh atmosphérique */}
        <div
          className="absolute inset-0 opacity-90 pointer-events-none"
          style={{
            background:
              'radial-gradient(at 15% 20%, rgba(86,69,212,0.35) 0px, transparent 45%),' +
              'radial-gradient(at 85% 15%, rgba(255,100,200,0.12) 0px, transparent 40%),' +
              'radial-gradient(at 75% 85%, rgba(86,69,212,0.25) 0px, transparent 45%),' +
              'radial-gradient(at 25% 90%, rgba(0,117,222,0.12) 0px, transparent 40%)',
          }}
        />
        {/* Fils / mesh décoratifs */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.18] pointer-events-none" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="wire" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#5645d4" stopOpacity="0" />
              <stop offset="50%" stopColor="#7b3ff2" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#ff64c8" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: 12 }).map((_, i) => (
            <path
              key={i}
              d={`M ${-50 + i * 60} 900 Q ${150 + i * 25} ${450 - i * 15}, ${500 + i * 15} ${-40}`}
              stroke="url(#wire)"
              strokeWidth="1.5"
              fill="none"
            />
          ))}
        </svg>
        {/* Points colorés façon sticky-notes */}
        <div className="absolute top-[18%] right-[22%] w-3 h-3 rounded-full bg-[#ff64c8] opacity-80" />
        <div className="absolute top-[30%] right-[14%] w-2 h-2 rounded-full bg-[#f5d75e] opacity-80" />
        <div className="absolute top-[60%] right-[30%] w-2.5 h-2.5 rounded-full bg-[#2a9d99] opacity-80" />
        <div className="absolute top-[44%] left-[14%] w-2 h-2 rounded-full bg-[#dd5b00] opacity-70" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5645d4] shadow-lg shadow-[#5645d4]/40">
            <Scissors className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight leading-none">TextilePOS</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/45 mt-1">Pro Edition</div>
          </div>
        </div>

        {/* Accroche */}
        <div className="relative z-10 space-y-8">
          <h1 className="font-display text-5xl xl:text-6xl leading-[1.05] tracking-tight">
            {t('login.tagline1')}
            <br />
            <span className="text-[#a78bfa]">{t('login.tagline2')}</span>
          </h1>
          <p className="text-lg text-white/65 max-w-md leading-relaxed">
            {t('login.description')}
          </p>

          {/* Mini-features */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Feature icon={Boxes} label={t('login.stat_products')} value="120" />
            <Feature icon={TrendingUp} label={t('login.stat_realtime')} value="24/7" />
            <Feature icon={Zap} label="Instantané" value="WhatsApp" />
          </div>
        </div>

        {/* Bas de panneau */}
        <div className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} TextilePOS · {t('login.rights')}
        </div>
      </div>

      {/* ===== Panneau formulaire ===== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        {/* Logo mobile */}
        <div className="lg:hidden absolute top-6 left-6 rtl:left-auto rtl:right-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Scissors className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">TextilePOS</span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-[0.15em]">{t('login.welcome')}</p>
            <h2 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight">{t('login.connect_title')}</h2>
            <p className="text-muted-foreground text-sm">{t('login.identifiers')}</p>
          </div>

          <LoginForm />

          <p className="text-xs text-center text-muted-foreground">{t('login.need_help')}</p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] border border-white/10 px-3.5 py-2.5 backdrop-blur-sm">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
        <Icon className="h-4 w-4 text-[#a78bfa]" />
      </div>
      <div>
        <div className="text-sm font-semibold leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-white/50 mt-1">{label}</div>
      </div>
    </div>
  );
}

export function LoginView() {
  return (
    <I18nProvider initialLang="ar">
      <LoginContent />
    </I18nProvider>
  );
}
