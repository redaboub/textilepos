import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { StockAddClient } from './stock-add-client';

export const metadata: Metadata = { title: 'Ajout de stock' };

export default async function StockAddPage() {
  const profile = await requireAuth();
  return <StockAddClient profile={profile} />;
}
