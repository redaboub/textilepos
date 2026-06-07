import { redirect } from 'next/navigation';

// La fonctionnalité de transfert entre magasins a été supprimée (mono-magasin).
export default function TransfersPage() {
  redirect('/stock');
}
