import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { ChecksClient } from './checks-client';

export const metadata: Metadata = { title: 'Chèques' };

export default async function ChecksPage() {
  const profile = await requireAuth();
  return <ChecksClient profile={profile} />;
}
