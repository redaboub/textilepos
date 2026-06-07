import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function formatPhone(value: string | null | undefined) {
  if (!value) return '';
  // Garde uniquement les chiffres
  let digits = value.replace(/\D/g, '');
  // Retire l'indicatif 212 s'il est présent en tête
  if (digits.startsWith('212')) digits = digits.slice(3);
  // Retire un éventuel 0 initial
  if (digits.startsWith('0')) digits = digits.slice(1);
  // Garde les 10 derniers chiffres max
  digits = digits.slice(-10);
  return `+212 ${digits}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'MAD';
export const LOCALE = process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'fr-MA';

export function formatCurrency(value: number | null | undefined, _options?: { compact?: boolean }) {
  const v = value ?? 0;
  // Toujours afficher le montant exact (jamais "10K DH"), conformément
  // à la demande métier. Le paramètre compact est ignoré volontairement.
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

export function formatNumber(value: number | null | undefined, fractionDigits = 2) {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value ?? 0);
}

export function formatMeters(value: number | null | undefined) {
  return `${formatNumber(value, 2)} m`;
}

export function formatDate(value: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...opts,
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const minute = 60_000, hour = 3600_000, day = 86400_000;
  if (diff < minute) return "à l'instant";
  if (diff < hour) return `il y a ${Math.floor(diff / minute)} min`;
  if (diff < day) return `il y a ${Math.floor(diff / hour)} h`;
  if (diff < 7 * day) return `il y a ${Math.floor(diff / day)} j`;
  return formatDate(d);
}

export function generateSerialNumber(prefix = 'RL') {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}

export function generateBarcode() {
  // EAN-13-like (12 chiffres + 1 check digit simple)
  let body = '';
  for (let i = 0; i < 12; i++) body += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(body[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return body + check;
}

export function safeNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

export function clampMeters(v: number, max: number) {
  if (v < 0) return 0;
  if (v > max) return max;
  return Math.round(v * 100) / 100;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
