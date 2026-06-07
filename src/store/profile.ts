'use client';

import { create } from 'zustand';
import type { Profile } from '@/types/database';

interface ProfileState {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  isSuperAdmin: () => boolean;
  storeId: () => string | null;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  setProfile: (p) => set({ profile: p }),
  isSuperAdmin: () => get().profile?.role === 'super_admin',
  storeId: () => get().profile?.store_id ?? null,
}));
