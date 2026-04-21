import RegistryManagement from './RegistryManagement';
import { User } from '../types';

export default function Cadastros({ user }: { user: User }) {
  return <RegistryManagement user={user} />;
}
