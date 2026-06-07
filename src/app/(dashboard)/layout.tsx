import { requireAuth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { I18nProvider } from '@/lib/i18n/context';
import type { Lang } from '@/lib/i18n/translations';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();
  const initialLang = ((profile as any).language ?? 'ar') as Lang;

  return (
    <I18nProvider initialLang={initialLang} userId={profile.id}>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar fixe — desktop large uniquement (xl+). Tablette utilise le burger. */}
        <div className="hidden xl:flex w-64 shrink-0 sticky top-0 h-screen">
          <Sidebar profile={profile} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <Topbar profile={profile} />
          <main className="flex-1 p-4 xl:p-8 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </I18nProvider>
  );
}
