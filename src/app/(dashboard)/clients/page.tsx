import { Metadata } from 'next';
import { ClientsClient } from './clients-client';

export const metadata: Metadata = { title: 'Clients' };

export default function ClientsPage() {
  return <ClientsClient />;
}
