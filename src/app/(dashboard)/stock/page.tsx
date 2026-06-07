import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { StockClient } from './stock-client';

export const metadata: Metadata = { title: 'Stock · Rouleaux' };

export default async function StockPage() {
  const profile = await requireAuth();
  return <StockClient profile={profile} />;
}
