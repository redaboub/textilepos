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
 * À appeler DIRECTEMENT dans le gestionnaire de clic (de façon synchrone) :
 * ouvre la fenêtre d'impression tout de suite — les navigateurs n'autorisent
 * window.open que pendant un geste utilisateur. Le contenu sera écrit juste
 * après par printReceiptHtml().
 */
export function openReceiptWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  const win = window.open('', '_blank', 'width=420,height=640');
  if (win) {
    try {
      win.document.write('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:16px;color:#555">…</body></html>');
    } catch { /* noop */ }
  }
  return win;
}

/**
 * Imprime un ticket de façon TOTALEMENT isolée.
 * Méthode principale : écrire le ticket dans la FENÊTRE dédiée ouverte au
 * clic (openReceiptWindow). Elle ne contient QUE le ticket → l'aperçu
 * d'impression (navigateur ou tablette) montre EXACTEMENT le ticket.
 * C'est la méthode la plus fiable sur Android/Chrome tablette, où
 * l'impression depuis un iframe caché donne des aperçus erronés.
 * Repli : si la fenêtre a été bloquée (popup), on utilise un iframe.
 *
 * @param container un élément dont le contenu (innerHTML) est le ticket
 * @param win la fenêtre ouverte au clic via openReceiptWindow() (ou null)
 */
export function printReceiptHtml(container: HTMLElement | null, win?: Window | null) {
  if (typeof window === 'undefined' || !container) { win?.close(); return; }
  const html = container.innerHTML;
  if (!html.trim()) { win?.close(); return; }

  const doc = buildReceiptDocument(html);

  // --- Méthode 1 : fenêtre dédiée (aperçu exact, fiable sur tablette) ---
  if (win && !win.closed) {
    win.document.open();
    win.document.write(doc);
    win.document.close();
    return; // l'impression est lancée par le script embarqué dans la fenêtre
  }

  // --- Repli : iframe isolé (si le popup est bloqué) ---
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
  cw.document.write(doc);
  cw.document.close();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { iframe.remove(); } catch { /* noop */ }
  };
  cw.onafterprint = cleanup;
  setTimeout(cleanup, 60000);
}

/** Document HTML autonome du ticket : style + impression auto + fermeture auto. */
function buildReceiptDocument(html: string): string {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Ticket</title><style>' +
    '@page{size:80mm auto;margin:0}' +
    "html,body{margin:0;padding:0;background:#fff;color:#000;font-family:'Courier New',monospace;font-size:11px;line-height:1.4}" +
    '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}' +
    '</style></head><body>' + html +
    '<script>' +
    'window.onafterprint=function(){setTimeout(function(){window.close()},200)};' +
    'setTimeout(function(){window.focus();window.print()},250);' +
    '<\/script>' +
    '</body></html>'
  );
}
