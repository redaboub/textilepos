import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Profile, UserRole } from '@/types/database';

export async function getSessionUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*, store:stores(*)')
    .eq('id', user.id)
    .single();

  return data as Profile | null;
}

export async function requireAuth(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

export async function requireRole(roles: UserRole[]): Promise<Profile> {
  const profile = await requireAuth();
  if (!roles.includes(profile.role)) redirect('/dashboard');
  return profile;
}

export async function requireSuperAdmin() {
  return requireRole(['super_admin']);
}
