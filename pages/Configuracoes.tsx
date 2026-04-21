import Settings from './Settings';
import { User } from '../types';

export default function Configuracoes({ user }: { user: User }) {
  return <Settings user={user} />;
}
