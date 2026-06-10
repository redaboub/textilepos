import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { SalesClient } from './sales-client';

export const metadata: Metadata = { title: 'Ventes' };

export default async function SalesPage() {
  const profile = await requireAuth();
  return <SalesClient role={profile.role} />;
}
