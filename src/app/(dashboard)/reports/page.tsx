import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { ReportsClient } from './reports-client';

export const metadata: Metadata = { title: 'Rapports' };

export default async function ReportsPage() {
  await requireAuth();
  return <ReportsClient />;
}
