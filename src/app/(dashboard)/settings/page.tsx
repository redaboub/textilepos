import { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { SettingsClient } from './settings-client';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function SettingsPage() {
  await requireSuperAdmin();
  return <SettingsClient />;
}
