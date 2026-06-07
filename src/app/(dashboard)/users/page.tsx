import { Metadata } from 'next';
import { requireSuperAdmin } from '@/lib/auth';
import { UsersClient } from './users-client';

export const metadata: Metadata = { title: 'Utilisateurs' };

export default async function UsersPage() {
  await requireSuperAdmin();
  return <UsersClient />;
}
