'use client';

import { create } from 'zustand';
import type { Product, CartItem } from '@/types/database';

interface POSState {
  items: CartItem[];
  clientId: string | null;
  clientName: string | null;
  globalDiscountPercent: number;
  taxRate: number;
  notes: string;

  addItem: (product: Product, meters: number) => void;
  updateItem: (productId: string, patch: Partial<CartItem>) => void;
  removeItem: (productId: string) => void;
  setClient: (id: string | null, name: string | null) => void;
  setGlobalDiscountPercent: (pct: number) => void;
  setTaxRate: (rate: number) => void;
  setNotes: (notes: string) => void;
  clear: () => void;

  subtotal: () => number;
  itemsDiscount: () => number;
  globalDiscountAmount: () => number;
  taxAmount: () => number;
  total: () => number;
  itemCount: () => number;
  totalMeters: () => number;
}

export const usePOSStore = create<POSState>((set, get) => ({
  items: [],
  clientId: null,
  clientName: null,
  globalDiscountPercent: 0,
  taxRate: 0,
  notes: '',

  addItem: (product, meters) => {
    const existing = get().items.find((i) => i.product.id === product.id);
    if (existing) {
      const newMeters = Math.min(existing.meters + meters, product.stock_meters);
      set({
        items: get().items.map((i) =>
          i.product.id === product.id ? { ...i, meters: newMeters } : i
        ),
      });
    } else {
      const item: CartItem = {
        product,
        meters: Math.min(meters, product.stock_meters),
        price_per_meter: product.price,
        discount_percent: 0,
        item_type: 'meter',
      };
      set({ items: [...get().items, item] });
    }
  },

  updateItem: (productId, patch) => {
    set({
      items: get().items.map((i) =>
        i.product.id === productId
          ? {
              ...i,
              ...patch,
              meters: patch.meters !== undefined
                ? Math.min(Math.max(patch.meters, 0), i.product.stock_meters)
                : i.meters,
              discount_percent: patch.discount_percent !== undefined
                ? Math.min(Math.max(patch.discount_percent, 0), 100)
                : i.discount_percent,
            }
          : i
      ),
    });
  },

  removeItem: (productId) =>
    set({ items: get().items.filter((i) => i.product.id !== productId) }),

  setClient: (id, name) => set({ clientId: id, clientName: name }),
  setGlobalDiscountPercent: (pct) => set({ globalDiscountPercent: Math.max(0, Math.min(100, pct)) }),
  setTaxRate: (rate) => set({ taxRate: Math.max(0, Math.min(100, rate)) }),
  setNotes: (notes) => set({ notes }),

  clear: () =>
    set({
      items: [],
      clientId: null,
      clientName: null,
      globalDiscountPercent: 0,
      notes: '',
    }),

  subtotal: () =>
    get().items.reduce((sum, i) => {
      const line = i.meters * i.price_per_meter;
      return sum + (line - line * (i.discount_percent / 100));
    }, 0),

  itemsDiscount: () =>
    get().items.reduce((sum, i) => {
      const line = i.meters * i.price_per_meter;
      return sum + line * (i.discount_percent / 100);
    }, 0),

  globalDiscountAmount: () => get().subtotal() * (get().globalDiscountPercent / 100),

  taxAmount: () => {
    const sub = get().subtotal() - get().globalDiscountAmount();
    return Math.max(0, sub) * (get().taxRate / 100);
  },

  total: () => {
    const sub = get().subtotal() - get().globalDiscountAmount() + get().taxAmount();
    return Math.max(0, Math.round(sub * 100) / 100);
  },

  itemCount: () => get().items.length,
  totalMeters: () => get().items.reduce((s, i) => s + i.meters, 0),
}));
