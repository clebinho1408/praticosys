import { Navigate } from 'react-router-dom';
import RegistryManagement from './RegistryManagement';
import { User, UserRole } from '../types';

export default function Cadastros({ user }: { user: User }) {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERVISOR) {
    return <Navigate to="/admin" replace />;
  }
  return <RegistryManagement user={user} />;
}
