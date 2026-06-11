import { redirect } from 'next/navigation';

// La page Rapports a été fusionnée dans « Ventes ».
// On redirige toute ancienne URL /reports vers /sales.
export default function ReportsPage() {
  redirect('/sales');
}
