import { redirect } from 'next/navigation';

// La page Achats a été supprimée : les réceptions de marchandise se font
// désormais via "Mouvements de stock" (entrée avec motif réception),
// avec historique complet et traçabilité.
export default function PurchasesPage() {
  redirect('/stock-add');
}
