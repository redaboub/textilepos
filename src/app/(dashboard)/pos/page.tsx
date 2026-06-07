import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { POSClient } from './pos-client';

export const metadata: Metadata = { title: 'Caisse' };

export default async function POSPage() {
  const profile = await requireAuth();
  return <POSClient profile={profile} />;
}
