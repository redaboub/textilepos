import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const clientSchema = z.object({
  name: z.string().min(2, 'Nom requis (2+ caractères)'),
  phone: z.string().regex(/^0\d{9}$/, 'Le téléphone doit commencer par 0 et comporter 10 chiffres (ex. 0612345678)'),
  email: z.string().email('Email invalide').optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const supplierSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  contact_name: z.string().optional().nullable(),
  phone: z.string().regex(/^0\d{9}$/, 'Le téléphone doit commencer par 0 et comporter 10 chiffres (ex. 0612345678)'),
  email: z.string().email('Email invalide').optional().or(z.literal('')).nullable(),
  address: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const productSchema = z.object({
  name: z.string().min(2, 'Nom requis'),
  sku: z.string().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  color: z.string().optional().nullable(),
  width_cm: z.coerce.number().positive().optional().nullable(),
  default_price_per_meter: z.coerce.number().nonnegative('Prix invalide'),
  description: z.string().optional().nullable(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const rollSchema = z.object({
  product_id: z.string().uuid('Produit requis'),
  store_id: z.string().uuid('Magasin requis'),
  supplier_id: z.string().uuid().optional().nullable(),
  serial_number: z.string().min(3, 'N° série requis'),
  barcode: z.string().optional().nullable(),
  initial_length: z.coerce.number().positive('Longueur invalide'),
  purchase_price_per_meter: z.coerce.number().nonnegative(),
  selling_price_per_meter: z.coerce.number().positive('Prix de vente invalide'),
  low_stock_threshold: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type RollInput = z.infer<typeof rollSchema>;

export const expenseSchema = z.object({
  store_id: z.string().uuid('Magasin requis'),
  category_id: z.string().uuid().optional().nullable(),
  description: z.string().min(2, 'Description requise'),
  amount: z.coerce.number().positive('Montant invalide'),
  payment_method: z.enum(['cash', 'card', 'check', 'transfer']),
  expense_date: z.string(),
  notes: z.string().optional().nullable(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const checkSchema = z.object({
  store_id: z.string().uuid(),
  type: z.enum(['incoming', 'outgoing']),
  check_number: z.string().min(1),
  bank_name: z.string().optional().nullable(),
  issuer_name: z.string().min(2),
  client_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive(),
  issue_date: z.string(),
  due_date: z.string(),
  notes: z.string().optional().nullable(),
});
export type CheckInput = z.infer<typeof checkSchema>;

export const userSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(['super_admin', 'caissier']),
  store_id: z.string().uuid().optional().nullable(),
  phone: z.string().optional().nullable(),
});
export type UserInput = z.infer<typeof userSchema>;
