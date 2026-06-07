import { redirect } from 'next/navigation';

// Page Dépenses désactivée (non utilisée pour le moment).
export default function ExpensesPage() {
  redirect('/dashboard');
}
