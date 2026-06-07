import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DashboardClient } from './dashboard-client';
import { requireAuth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default async function DashboardPage() {
  const profile = await requireAuth();
  // Le caissier n'a pas accès au tableau de bord → rediriger vers la caisse
  if (profile.role !== 'super_admin') {
    redirect('/pos');
  }
  return <DashboardClient profile={profile} />;
}
