import { Metadata } from 'next';
import { LoginView } from './login-view';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Accédez à votre espace TextilePOS',
};

export default function LoginPage() {
  return <LoginView />;
}
