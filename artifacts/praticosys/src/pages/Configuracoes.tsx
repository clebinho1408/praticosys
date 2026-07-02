import { Navigate } from 'react-router-dom';
import Settings from './Settings';
import { User, UserRole } from '../types';

export default function Configuracoes({ user }: { user: User }) {
  if (user.role !== UserRole.ADMIN) {
    return <Navigate to="/admin" replace />;
  }
  return <Settings user={user} />;
}
