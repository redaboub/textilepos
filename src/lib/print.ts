/**
 * Helpers d'impression — gèrent le passage entre les différents formats
 * d'impression (ticket caisse 80mm, étiquette rouleau 50×30mm) en injectant
 * dynamiquement la bonne règle @page CSS avant d'appeler window.print().
 *
 * La règle @page n'est PAS scopable par classe CSS — c'est une limitation
 * du standard. La seule solution fiable est de l'injecter à la volée.
 */

type PrintMode = 'receipt' | 'label';

const PAGE_SIZES: Record<PrintMode, string> = {
  receipt: '80mm auto',
  label: '50mm 30mm',
};

const STYLE_ID = '__textilepos_print_style__';

function setPageSize(mode: PrintMode) {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `@page { margin: 0; size: ${PAGE_SIZES[mode]}; }`;
}

function removeCustomPageSize() {
  if (typeof document === 'undefined') return;
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

/**
 * Imprime en utilisant un mode spécifique.
 * Pose une classe sur <body>, injecte la règle @page, lance l'impression,
 * puis nettoie tout (que l'utilisateur ait imprimé ou annulé).
 */
export function printAs(mode: PrintMode) {
  if (typeof window === 'undefined') return;

  const body = document.body;
  const cls = `print-mode-${mode}`;

  // Nettoyer toute classe d'impression précédente
  body.classList.remove('print-mode-receipt', 'print-mode-label');
  body.classList.add(cls);

  setPageSize(mode);

  // Nettoyer après l'impression (qu'elle aboutisse ou soit annulée)
  const cleanup = () => {
    body.classList.remove(cls);
    removeCustomPageSize();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Petit délai pour laisser le navigateur appliquer les styles
  setTimeout(() => {
    window.print();
    // Filet de sécurité : si afterprint ne se déclenche pas (rare)
    setTimeout(cleanup, 1500);
  }, 50);
}

export const printReceipt = () => printAs('receipt');
export const printLabel = () => printAs('label');
