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

/**
 * Imprime un ticket de façon TOTALEMENT isolée, dans un iframe dédié.
 * L'iframe ne contient QUE le ticket → impossible d'avoir des pages en
 * double, ou d'imprimer la liste / l'écran de succès à la place.
 * Robuste sur tablette et navigateur (ne dépend d'aucune règle @media print
 * globale ni de classe sur <body>).
 *
 * @param container un élément dont le contenu (innerHTML) est le ticket
 */
export function printReceiptHtml(container: HTMLElement | null) {
  if (typeof window === 'undefined' || !container) return;
  const html = container.innerHTML;
  if (!html.trim()) return;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cw = iframe.contentWindow;
  if (!cw) { iframe.remove(); return; }

  cw.document.open();
  cw.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    '@page{size:80mm auto;margin:0}' +
    "html,body{margin:0;padding:0;background:#fff;color:#000;font-family:'Courier New',monospace;font-size:11px;line-height:1.4}" +
    '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}' +
    '</style></head><body>' + html + '</body></html>'
  );
  cw.document.close();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { iframe.remove(); } catch { /* noop */ }
  };
  cw.onafterprint = cleanup;

  // Laisser l'iframe se mettre en page avant d'imprimer
  setTimeout(() => {
    try { cw.focus(); cw.print(); } catch { cleanup(); }
  }, 150);

  // Filet de sécurité si afterprint ne se déclenche pas
  setTimeout(cleanup, 60000);
}
